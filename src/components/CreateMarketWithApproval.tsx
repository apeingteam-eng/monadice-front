"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useSwitchChain, useChainId } from "wagmi";
import { BrowserProvider, JsonRpcSigner, Contract, formatUnits } from "ethers";
import type { Eip1193Provider } from "ethers";
// ====== CONFIG ======
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FACTORY_ADDRESS = "0xED7cd209EcA8060e61Bdc2B3a3Ec895b42c6a2B6";
const USDC_DECIMALS = 6;
const REQUIRED_USDC = 1n * (10n ** BigInt(USDC_DECIMALS));
const FEE_BPS = 200;
const TARGET_CHAIN_ID = 84532; // Base Sepolia

// ====== ABIs ======
const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
const factoryAbi = [
  "function createCampaign(string name, string symbol, uint64 endTime, uint16 feeBps) external returns (address campaign)"
];

export default function CreateMarketWithApproval() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();

  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");

  // UTC date inputs
  const now = new Date();
  const [day, setDay] = useState<number>(now.getUTCDate());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [hour, setHour] = useState<number>(now.getUTCHours());
  const [minute, setMinute] = useState<number>(0);

  // ====== Setup signer ======
  useEffect(() => {
    async function setupSigner() {
      if (!walletClient || !address) return setSigner(null);

      // Use unknown instead of any for transport type
      const provider = new BrowserProvider(walletClient.transport as unknown as Eip1193Provider);

      const s = await provider.getSigner(address);
      setSigner(s);
    }
    setupSigner();
  }, [walletClient, address]);

  // ====== Fetch balance ======
  useEffect(() => {
    async function fetchBalance() {
      if (!signer || !address) return setUsdcBalance(null);
      try {
        const usdc = new Contract(USDC_ADDRESS, erc20Abi, signer);
        const bal = await usdc.balanceOf(address);
        setUsdcBalance(Number(formatUnits(bal, USDC_DECIMALS)));
      } catch {
        setUsdcBalance(null);
      }
    }
    fetchBalance();
  }, [signer, address, loading]);

  const getEndTime = () => {
    const year = new Date().getUTCFullYear();
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    return Math.floor(utcDate.getTime() / 1000);
  };

  // ====== Handle submit ======
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxHash(null);
    setStatus(null);
    setError(null);

    if (!isConnected || !address || !signer) {
      setError("⚠️ Wallet not connected.");
      return;
    }

    if (currentChainId !== TARGET_CHAIN_ID) {
      setError("⚠️ Wrong network. Please switch to Base Sepolia.");
      return;
    }

    if (!name.trim() || !symbol.trim()) {
      setError("Name and Symbol are required.");
      return;
    }

    const endTime = getEndTime();
    const nowUnix = Math.floor(Date.now() / 1000);
    if (endTime <= nowUnix) {
      setError("End time must be in the future (UTC).");
      return;
    }

    if (usdcBalance !== null && usdcBalance < 1) {
      setError("Insufficient USDC balance (need at least 1).");
      return;
    }

    try {
      setLoading(true);
      const usdc = new Contract(USDC_ADDRESS, erc20Abi, signer);
      const factory = new Contract(FACTORY_ADDRESS, factoryAbi, signer);

      setStatus("Checking USDC allowance…");
      const allowance = await usdc.allowance(address, FACTORY_ADDRESS);
      if (allowance < REQUIRED_USDC) {
        setStatus("Approving 1 USDC for factory…");
        const txApprove = await usdc.approve(FACTORY_ADDRESS, REQUIRED_USDC);
        await txApprove.wait();
        setStatus("✅ USDC approval confirmed.");
      }

      console.log("======= DEBUG LOG =======");
      console.log("Wallet Address:", address);
      console.log("Factory Address:", FACTORY_ADDRESS);
      console.log("USDC Address:", USDC_ADDRESS);
      console.log("Allowance:", (await usdc.allowance(address, FACTORY_ADDRESS)).toString());
      console.log("USDC Balance:", usdcBalance);
      console.log("End Time:", endTime, new Date(endTime * 1000).toUTCString());
      console.log("Name:", name);
      console.log("Symbol:", symbol);
      console.log("=========================");

      let tx;
      try {
        const gasEstimate = await factory.createCampaign.estimateGas(name, symbol, endTime, FEE_BPS);
        console.log("Estimated gas:", gasEstimate.toString());
        tx = await factory.createCampaign(name, symbol, endTime, FEE_BPS, { gasLimit: gasEstimate * 2n });
      } catch (err: unknown) {
        console.warn("Gas estimation failed, sending with manual limit:", err);
        tx = await factory.createCampaign(name, symbol, endTime, FEE_BPS, { gasLimit: 2_000_000 });
      }

      setStatus("Transaction sent. Waiting for confirmation…");
      const receipt = await tx.wait();

      setTxHash(receipt.hash);
      setStatus("✅ Market created successfully!");
      setName("");
      setSymbol("");

      // 🧠 Backend sync
      try {
        setStatus("🔄 Syncing backend with factory events...");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/sync`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Failed to sync factory events");
        setStatus("✅ Factory synced successfully!");
      } catch (syncErr: unknown) {
        console.error("Sync error:", syncErr);
        setStatus("⚠️ Market created, but sync failed. Please refresh manually.");
      }

    } catch (err: unknown) {
      console.error("❌ Error while creating:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Transaction failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ====== Network Switch ======
  const handleNetworkSwitch = async () => {
    try {
      await switchChain({ chainId: TARGET_CHAIN_ID });
    } catch {
      setError("Failed to switch network. Please switch manually.");
    }
  };

  const getExplorerUrl = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`;

  // ====== UI ======
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 p-6 bg-neutral-900 rounded-xl border border-neutral-800"
    >
      <h3 className="text-lg font-semibold text-white">Create New Market</h3>

      {currentChainId !== TARGET_CHAIN_ID && (
        <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-md text-sm text-yellow-400">
          ⚠️ You are on the wrong network.
          <button
            type="button"
            onClick={handleNetworkSwitch}
            className="underline hover:text-yellow-200 ml-1"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Name & Symbol */}
      <div>
        <label className="block text-sm text-neutral-400 mb-1">Market Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm focus:ring-1 focus:ring-accentPurple"
          placeholder="e.g. Bitcoin will stay above $70K"
        />
      </div>

      <div>
        <label className="block text-sm text-neutral-400 mb-1">Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm focus:ring-1 focus:ring-accentPurple"
          placeholder="BTC70K"
        />
      </div>

      {/* UTC Date Selector */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">End Date (UTC)</label>
        <div className="grid grid-cols-5 gap-2 text-sm">
          {([
            ["Day", day, setDay, 31],
            ["Month", month, setMonth, 12],
            ["Hour", hour, setHour, 23],
            ["Minute", minute, setMinute, 59],
          ] as [string, number, React.Dispatch<React.SetStateAction<number>>, number][]).map(
            ([label, val, setVal, max], i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-neutral-400 mb-1 text-xs">{label}</span>
                <input
                  type="number"
                  value={val}
                  min={0}
                  max={max}
                  onChange={(e) => setVal(Number(e.target.value))}
                  className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-center focus:ring-1 focus:ring-accentPurple w-16"
                />
              </div>
            )
          )}

          <div className="flex flex-col items-center">
            <span className="text-neutral-400 mb-1 text-xs">Year</span>
            <input
              type="text"
              value={new Date().getUTCFullYear()}
              readOnly
              className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-center text-neutral-500 w-16"
            />
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-center">
          UTC time — automatically converted for smart contract
        </p>
      </div>

      {/* USDC Balance */}
      <div className="text-sm text-neutral-400">
        USDC Balance: {usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : "— loading —"}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || currentChainId !== TARGET_CHAIN_ID}
        className="w-full rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing…" : "Create Market (1 USDC)"}
      </button>

      {status && <p className="text-sm text-neutral-300 mt-1">{status}</p>}
      {txHash && (
        <a
          href={getExplorerUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-accentPurple underline mt-1"
        >
          🔗 View Transaction on Explorer
        </a>
      )}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </form>
  );
}
