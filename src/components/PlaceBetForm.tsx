"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import type { Eip1193Provider } from "ethers";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_DECIMALS = 6;
const TARGET_CHAIN_ID = 84532; // Base Sepolia

const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const campaignAbi = ["function join(uint8 side, uint256 amount) external"];

type Props = {
  campaignAddress: string;
};

export default function PlaceBetForm({ campaignAddress }: Props) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [outcome, setOutcome] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [potentialPayout, setPotentialPayout] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingPayout, setFetchingPayout] = useState(false);

  // 🧮 Fetch potential payout dynamically
  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setPotentialPayout(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setFetchingPayout(true);
        const side = outcome === "Yes";
        const url = `${process.env.NEXT_PUBLIC_API_URL}/bet/potential-payout?campaign_address=${campaignAddress}&side=${side}&amount=${amount}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch payout");
        const data = await res.json();
        setPotentialPayout(data);
      } catch (err) {
        console.error("Payout fetch failed:", err);
        setPotentialPayout(null);
      } finally {
        setFetchingPayout(false);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [amount, outcome, campaignAddress]);

  // 🪙 Place Bet handler
  const handlePlaceBet = async () => {
    setError(null);
    setStatus(null);
    setTxHash(null);

    if (!isConnected || !walletClient || !address) {
      setError("Wallet not connected.");
      return;
    }

    if (chainId !== TARGET_CHAIN_ID) {
      setError("Wrong network. Please switch to Base Sepolia.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid bet amount.");
      return;
    }

    try {
      setLoading(true);

      // ✅ Type-safe BrowserProvider creation
      const provider = new BrowserProvider(
        walletClient.transport as unknown as Eip1193Provider
      );
      const signer = await provider.getSigner(address);

      const usdc = new Contract(USDC_ADDRESS, erc20Abi, signer);
      const campaign = new Contract(campaignAddress, campaignAbi, signer);

      const parsedAmount = parseUnits(amount, USDC_DECIMALS);
      const allowance = await usdc.allowance(address, campaignAddress);

      if (allowance < parsedAmount) {
        setStatus("Approving USDC for campaign…");
        const approveTx = await usdc.approve(campaignAddress, parsedAmount);
        await approveTx.wait();
        setStatus("✅ Approval confirmed.");
      }

      const side = outcome === "Yes" ? 1 : 0;

      setStatus("Placing bet on-chain…");
      const tx = await campaign.join(side, parsedAmount);
      const receipt = await tx.wait();

      setTxHash(receipt.hash);
      setStatus("✅ Bet placed successfully!");

      // 🔄 Sync backend bets
      try {
        setStatus("🔄 Syncing bets with backend...");
        const syncRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bet/sync-bets?campaign_address=${campaignAddress}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (!syncRes.ok) throw new Error("Failed to sync bets");
        setStatus("✅ Bets synced successfully!");
      } catch (syncErr: unknown) {
        console.error("Sync error:", syncErr);
        setStatus("⚠️ Bet confirmed, but sync failed. Please refresh manually.");
      }
    } catch (err: unknown) {
      console.error("Bet error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Transaction failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getExplorerUrl = (hash: string) =>
    `https://sepolia.basescan.org/tx/${hash}`;

  return (
    <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 space-y-3">
      <h3 className="text-base font-semibold">Place Bet</h3>

      <label className="text-sm">Outcome</label>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as "Yes" | "No")}
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accentPurple/50"
      >
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>

      <label className="text-sm">Amount (USDC)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accentPurple/50"
      />

      {/* 💰 Show potential payout */}
      {fetchingPayout ? (
        <p className="text-xs text-neutral-500">Calculating potential payout…</p>
      ) : potentialPayout ? (
        <div className="text-sm text-neutral-300">
          <span className="font-medium text-accentPurple">Potential Payout:</span>{" "}
          ${Number(potentialPayout).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ) : null}

      <button
        onClick={handlePlaceBet}
        disabled={loading}
        className="w-full rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Processing…" : "Place Bet"}
      </button>

      {status && <p className="text-sm text-neutral-300">{status}</p>}
      {txHash && (
        <a
          href={getExplorerUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-accentPurple underline"
        >
          🔗 View Transaction
        </a>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      <p className="text-xs text-neutral-500">
        Market address:{" "}
        <span className="font-mono text-neutral-400">
          {campaignAddress.slice(0, 6)}…{campaignAddress.slice(-4)}
        </span>
      </p>
    </div>
  );
}
