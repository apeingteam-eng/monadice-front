"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import type { Eip1193Provider } from "ethers";

import { ERC20ABI, BetCampaignABI } from "@/lib/ethers/abi";
import { useToast } from "@/components/toast/ToastContext";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_DECIMALS = 6;
const TARGET_CHAIN_ID = 84532; // Base Sepolia

type Props = {
  campaignAddress: string;
  bettingClosed: boolean;
};
export default function PlaceBetForm({ campaignAddress, bettingClosed }: Props) {  const toast = useToast();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [outcome, setOutcome] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [potentialPayout, setPotentialPayout] = useState<string | null>(null);
  const [fetchingPayout, setFetchingPayout] = useState(false);
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*                 🔮 Fetch dynamic payout preview from backend               */
  /* -------------------------------------------------------------------------- */
  
  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setPotentialPayout(null);
      return;
    }

    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      try {
        setFetchingPayout(true);

        const side = outcome === "Yes";
        const url = `${process.env.NEXT_PUBLIC_API_URL}/bet/potential-payout?campaign_address=${campaignAddress}&side=${side}&amount=${amount}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Payout fetch failed");

        const data = await res.json();
        setPotentialPayout(data);
      } catch {
        setPotentialPayout(null);
      } finally {
        setFetchingPayout(false);
      }
    }, 400);

    return () => {
      clearTimeout(debounce);
      controller.abort();
    };
  }, [amount, outcome, campaignAddress]);

  /* -------------------------------------------------------------------------- */
  /*                                🪙 Place Bet                                 */
  /* -------------------------------------------------------------------------- */
   if (bettingClosed) {
    return (
      <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 text-center">
        <h3 className="text-base font-semibold mb-2">Place Bet</h3>
        <p className="text-neutral-400 text-sm">
          This market is closed for betting.
        </p>
      </div>
    );
  }
  const handlePlaceBet = async () => {
    if (!isConnected || !walletClient || !address) {
      toast.error("Wallet not connected.");
      return;
    }

    if (chainId !== TARGET_CHAIN_ID) {
      toast.error("Please switch to Base Sepolia.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid USDC bet amount.");
      return;
    }

    try {
      setLoading(true);

      // Provider + Signer
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner(address);

      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer);
      const campaign = new Contract(campaignAddress, BetCampaignABI, signer);

      const parsedAmount = parseUnits(amount, USDC_DECIMALS);

      /* ------------------------------ Check Allowance ------------------------------ */
      toast.info("Checking allowance…");

      const allowance = await usdc.allowance(address, campaignAddress);
      if (allowance < parsedAmount) {
        toast.info("Approving USDC…");

        const approveTx = await usdc.approve(campaignAddress, parsedAmount);
        await approveTx.wait();

        toast.success("USDC approved!");
      }

      /* ------------------------------- Place Bet ---------------------------------- */
      const side = outcome === "Yes" ? 1 : 0;

      toast.info("Placing bet on-chain…");

      const tx = await campaign.join(side, parsedAmount);
      const receipt = await tx.wait();

      toast.success("Bet placed successfully!");

      /* ------------------------------ Backend Sync --------------------------------- */
      try {
        toast.info("Syncing bet with backend…");

        const sync = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bet/sync-bets?campaign_address=${campaignAddress}`
        );

        if (!sync.ok) throw new Error("Sync failed");
        toast.success("Bet synced with backend!");
      } catch {
        toast.error("Bet placed, but backend sync failed. Refresh manually.");
      }
    } catch (err: unknown) {
  console.error("Bet error:", err);

  // Extract a safe human-readable message
  const errMsg =
    err instanceof Error ? err.message : String(err ?? "Transaction failed");

  // MetaMask rejection (basic)
  if (typeof err === "object" && err && "code" in err && (err as any).code === 4001) {
    toast.error("Transaction cancelled.");
    return;
  }

  // ethers.js nested structure
  const reason =
    (err as any)?.reason ||
    (err as any)?.info?.error?.message ||
    errMsg;

  // Insufficient USDC
  if (reason?.includes("transfer amount exceeds balance")) {
    toast.error("You don't have enough USDC to place this bet.");
    return;
  }

  // Approval cancelled
  if (reason?.toLowerCase().includes("approve")) {
    toast.error("Approval cancelled.");
    return;
  }

  // Generic "denied" rejection
  if (reason?.toLowerCase().includes("denied")) {
    toast.error("You cancelled the transaction.");
    return;
  }

  // fallback
  toast.error(reason);
} finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                   UI                                       */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 space-y-3">
      <h3 className="text-base font-semibold">Place Bet</h3>

      {/* Outcome Selector */}
      <label className="text-sm">Outcome</label>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as "Yes" | "No")}
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm"
      >
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>

      {/* Amount */}
      <label className="text-sm">Amount (USDC)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm"
      />

      {/* Payout */}
      {fetchingPayout ? (
        <p className="text-xs text-neutral-500">Calculating payout…</p>
      ) : potentialPayout ? (
        <div className="text-sm text-neutral-300">
          <span className="font-medium text-accentPurple">Potential Payout:</span>{" "}
          ${Number(potentialPayout).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      ) : null}

      {/* Place Bet Button */}
      <button
        onClick={handlePlaceBet}
        disabled={loading}
        className="w-full rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Processing…" : "Place Bet"}
      </button>

      <p className="text-xs text-neutral-500">
        Market:{" "}
        <span className="font-mono">
          {campaignAddress.slice(0, 6)}…{campaignAddress.slice(-4)}
        </span>
      </p>
    </div>
  );
}