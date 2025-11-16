"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import type { Eip1193Provider } from "ethers";

import { ERC20ABI, BetCampaignABI } from "@/lib/ethers/abi";
import { useToast } from "@/components/toast/ToastContext";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_DECIMALS = 6;
const TARGET_CHAIN_ID = 84532;

type Props = {
  campaignAddress: string;
  bettingClosed: boolean;
};

type PayoutResponse = {
  potential_payout: number;
  estimated_profit: number;
};

export default function PlaceBetForm({ campaignAddress, bettingClosed }: Props) {
  const toast = useToast();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [outcome, setOutcome] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [fetchingPayout, setFetchingPayout] = useState(false);
  const [loading, setLoading] = useState(false);

  /* --------------------- Fetch payout preview ----------------------------- */
  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setPayoutData(null);
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

        // 👇 Correct shape
        const json = (await res.json()) as PayoutResponse;

        if (
          typeof json.potential_payout === "number" &&
          typeof json.estimated_profit === "number"
        ) {
          setPayoutData(json);
        } else {
          console.error("Unexpected payout format:", json);
          setPayoutData(null);
        }
      } catch (err) {
        setPayoutData(null);
      } finally {
        setFetchingPayout(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [amount, outcome, campaignAddress]);

  /* --------------------------- Betting Closed ------------------------------ */
  if (bettingClosed) {
    return (
      <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 text-center">
        <h3 className="text-base font-semibold mb-2">Place Bet</h3>
        <p className="text-neutral-400 text-sm">This market is closed for betting.</p>
      </div>
    );
  }

  /* --------------------------- Place Bet ---------------------------------- */
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
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);

      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner(address);

      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer);
      const campaign = new Contract(campaignAddress, BetCampaignABI, signer);

      const parsedAmount = parseUnits(amount, USDC_DECIMALS);

      toast.info("Checking allowance...");

      const allowance: bigint = await usdc.allowance(address, campaignAddress);
      if (allowance < parsedAmount) {
        toast.info("Sending approval…");

        const approveTx = await usdc.approve(campaignAddress, parsedAmount);

        toast.info("Waiting for approval confirmations…");

        // 🔥 Wait for 2 confirmations to ensure allowance is indexed
        await approveTx.wait(2);

        // 🔄 Double-check allowance to avoid race conditions
        let updatedAllowance = await usdc.allowance(address, campaignAddress);
        while (updatedAllowance < parsedAmount) {
          await new Promise((resolve) => setTimeout(resolve, 600)); 
          updatedAllowance = await usdc.allowance(address, campaignAddress);
        }

        toast.success("USDC approved!");
      }

      toast.info("Placing bet...");
      const side = outcome === "Yes" ? 1 : 0;

      const tx = await campaign.join(side, parsedAmount);
      await tx.wait();

      toast.success("Bet placed!");

      // Sync backend
      try {
        const sync = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bet/sync-bets?campaign_address=${campaignAddress}`
        );
        if (!sync.ok) throw new Error("Sync failed");
        toast.success("Synced with backend!");
      } catch {
        toast.error("Bet placed, but backend sync failed.");
      }
    } catch (err: unknown) {
      console.error("Bet error:", err);

      const msg =
        err instanceof Error ? err.message : String(err ?? "Transaction failed");

      if (msg.includes("transfer amount exceeds balance")) {
        toast.error("Not enough USDC.");
        return;
      }

      if (msg.includes("4001") || msg.toLowerCase().includes("cancel")) {
        toast.error("Transaction cancelled.");
        return;
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------- UI --------------------------------------- */
  return (
    <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 space-y-4">
      <h3 className="text-base font-semibold">Place Bet</h3>

      <label className="text-sm">Outcome</label>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as "Yes" | "No")}
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm"
      >
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>

      <label className="text-sm">Amount (USDC)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm"
      />

      {/* ----------- Payout Section ----------- */}
      {fetchingPayout ? (
        <p className="text-xs text-neutral-500">Calculating payout…</p>
      ) : payoutData ? (
        <div className="text-sm text-neutral-300 space-y-1">
          <div>
            <span className="font-medium text-accentPurple">Potential Payout: </span>
            ${payoutData.potential_payout.toFixed(3)}
          </div>
          <div>
            <span className="font-medium text-neutral-400">Estimated Profit: </span>
            {payoutData.estimated_profit >= 0 ? "+" : ""}
            {payoutData.estimated_profit.toFixed(3)} USDC
          </div>
        </div>
      ) : null}

      <button
        onClick={handlePlaceBet}
        disabled={loading}
        className="w-full rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Processing…" : "Place Bet"}
      </button>

      <p className="text-xs text-neutral-500">
        Market: {campaignAddress.slice(0, 6)}…{campaignAddress.slice(-4)}
      </p>
    </div>
  );
}