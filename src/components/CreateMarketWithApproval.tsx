"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useSwitchChain, useChainId } from "wagmi";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  JsonRpcSigner,
} from "ethers";
import type { Eip1193Provider } from "ethers";

import { BetMarketFactoryABI, ERC20ABI } from "@/lib/ethers/abi";

/* -------------------------------------------------------------------------- */
/*                                  CONFIG                                    */
/* -------------------------------------------------------------------------- */
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FACTORY_ADDRESS = "0xED7cd209EcA8060e61Bdc2B3a3Ec895b42c6a2B6";

const USDC_DECIMALS = 6;
const REQUIRED_USDC = 1n * 10n ** BigInt(USDC_DECIMALS);
const TARGET_CHAIN_ID = 84532;

export default function CreateMarketTwoStep() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [allowanceEnough, setAllowanceEnough] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("CRYPTO");
  const [endTime, setEndTime] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  /* ---------------------------- Init signer -------------------------------- */
  useEffect(() => {
    async function setup() {
      if (!walletClient || !address) {
        setSigner(null);
        return;
      }
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const s = await provider.getSigner(address);
      setSigner(s);
    }
    setup();
  }, [walletClient, address]);

  /* ------------------------- Check allowance ------------------------------- */
  useEffect(() => {
    async function checkAllowance() {
      if (!signer || !address) return;
      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer);
      const allowance = await usdc.allowance(address, FACTORY_ADDRESS);

      setAllowanceEnough(allowance >= REQUIRED_USDC);
    }
    checkAllowance();
  }, [signer, address]);

  /* ---------------------------- Approve Logic ------------------------------ */
  const handleApprove = async () => {
    setError(null);
    setStatus("Approving USDC…");
    setLoading(true);

    try {
      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer!);

      const tx = await usdc.approve(FACTORY_ADDRESS, REQUIRED_USDC);
      await tx.wait();

      setStatus("USDC approved!");
      setAllowanceEnough(true);
    } catch (err: any) {
      setError(err.message ?? "Approve failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------- Create Campaign ---------------------------- */
  const handleCreateMarket = async () => {
  setError(null);
  setStatus(null);
  setTxHash(null);

  if (!name.trim()) return setError("Market name required.");
  if (!endTime) return setError("End time required.");
  if (chainId !== TARGET_CHAIN_ID) return setError("Wrong network.");

  setLoading(true);

  try {
    const factory = new Contract(
      FACTORY_ADDRESS,
      BetMarketFactoryABI,
      signer!
    );

    const unixEnd = Math.floor(new Date(endTime).getTime() / 1000);

    // -------------------------
    // CREATE CAMPAIGN
    // -------------------------
    setStatus("Creating market…");

    const tx = await factory.createCampaign(
      name,
      category,
      unixEnd,
      200 // fee bps
    );

    setStatus("Waiting for confirmation…");
    const receipt = await tx.wait();

    setTxHash(receipt.hash);
    setStatus("Market created on-chain!");

    // -------------------------
    // SYNC BACKEND
    // -------------------------
    setStatus("Syncing backend…");

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/factory/sync`,
      { method: "GET" }
    );

    if (!res.ok) {
      setStatus("Market created but backend sync failed.");
      console.warn("Sync error:", await res.text());
      return;
    }

    setStatus("Backend synced successfully! 🎉");

    // OPTIONAL: redirect after sync
    // router.push("/markets");

  } catch (err: any) {
    console.error(err);
    setError(err.message ?? "Create failed.");
  } finally {
    setLoading(false);
  }
};
  /* ------------------------------ UI -------------------------------------- */
  return (
    <form className="space-y-5 p-6 bg-neutral-900 border border-neutral-800 rounded-xl">
      <h2 className="text-white text-lg font-semibold">Create Market</h2>

      {/* TITLE */}
      <div>
        <label className="text-neutral-400 text-sm">Market Name</label>
        <input
          className="w-full mt-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* CATEGORY */}
      <div>
        <label className="text-neutral-400 text-sm">Category</label>
        <select
          className="w-full mt-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["CRYPTO", "SPORTS", "POLITICS", "SOCIAL"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* TIME */}
      <div>
        <label className="text-neutral-400 text-sm">End Time</label>
        <input
          type="datetime-local"
          className="w-full mt-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </div>

      {/* BUTTON LOGIC */}
      {!allowanceEnough ? (
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading}
          className="w-full bg-purple-600 py-2 rounded-md text-white disabled:opacity-50"
        >
          {loading ? "Approving…" : "Approve 1 USDC"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCreateMarket}
          disabled={loading}
          className="w-full bg-accentPurple py-2 rounded-md text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Market"}
        </button>
      )}

      {status && <p className="text-neutral-300">{status}</p>}
      {error && <p className="text-red-500">{error}</p>}
      {txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          className="underline text-accentPurple"
        >
          View Transaction
        </a>
      )}
    </form>
  );
}