"use client";

import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network";
import { useToast } from "@/components/toast/ToastContext";
import { useAccount, useWriteContract } from "wagmi";

/* ------------------------------- Types ------------------------------- */
type Ticket = {
  id: number;
  side: number;   // 0 or 1
  stake: number;  // in USDC (already /1e6)
  claimed: boolean;
};

type ClaimViewProps = {
  campaignAddress: `0x${string}`;
  endTime: number;        // unix seconds
  backendState: string;   // expected "open" or "closed"
};

/* --------------------------- Main Component --------------------------- */
export default function ClaimView({
  campaignAddress,
  endTime,
  backendState,
}: ClaimViewProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();

  const [loading, setLoading] = useState(true);

  // on-chain state: 0=open, 1=resolved, 2=cancelled (from your contract)
  const [state, setState] = useState<number | null>(null);
  const [outcomeTrue, setOutcomeTrue] = useState<boolean | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [winningTickets, setWinningTickets] = useState<Ticket[]>([]);
  const [totalPayout, setTotalPayout] = useState<number>(0);

  /* --------------------------- Load All Data --------------------------- */
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignAddress, address]);

  async function loadAll() {
    if (!address) return;

    try {
      setLoading(true);

      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      const contract = new Contract(campaignAddress, BetCampaignABI, provider);

      const now = Math.floor(Date.now() / 1000);

      /* ---------------------- On-chain reads ---------------------- */
      const s: number = await contract.state();
      const outcome: boolean = await contract.outcomeTrue();
      const nextId: bigint = await contract.nextTicketId();

      const totalTrue: bigint = await contract.totalTrue();
      const totalFalse: bigint = await contract.totalFalse();
      const totalInitialPot: bigint = await contract.totalInitialPot();
      const feeBps: bigint = await contract.feeBps();

      console.log("=== 🧪 CLAIM DEBUG STATS ===");
      console.log("totalTrue raw:", totalTrue.toString());
      console.log("totalFalse raw:", totalFalse.toString());
      console.log("totalInitialPot raw:", totalInitialPot.toString());
      console.log("feeBps:", feeBps.toString());

      /* -------------------------- Logging -------------------------- */
      console.log("=== 🔍 CLAIM VIEW DEBUG LOGS ===");
      console.log("Campaign:", campaignAddress);
      console.log("Wallet:", address);
      console.log("⏳ endTime:", endTime);
      console.log("⏰ now:", now);
      console.log("📌 On-chain state:", s);
      console.log("📌 outcomeTrue:", outcome);
      console.log("🎫 nextTicketId:", nextId);
      console.log("-------------------------------");

      /* ------------------- Calculate pool totals ------------------- */
      const pool =
        Number(totalTrue) / 1e6 +
        Number(totalFalse) / 1e6 +
        Number(totalInitialPot) / 1e6;

      const fee = pool * Number(feeBps) / 10000;
      const distributable = pool - fee;

      setState(s);
      setOutcomeTrue(outcome);

      /* ------------------- Load owned tickets --------------------- */
      const owned: Ticket[] = [];

      for (let i = 1; i < Number(nextId); i++) {
        try {
          const owner = await contract.ownerOf(i);
          if (owner.toLowerCase() !== address.toLowerCase()) continue;

          const t = await contract.tickets(i);

          owned.push({
            id: Number(t.id),
            side: Number(t.side),
            stake: Number(t.stake) / 1e6,
            claimed: t.claimed,
          });
          const feDidWin = outcome ? Number(t.side) === 1 : Number(t.side) === 0;
          console.log(`Ticket ${Number(t.id)} FE says win=${feDidWin} side=${Number(t.side)}`);
        } catch {
          // ignore tickets that revert (burned / non-existent)
        }
      }

      console.log("owned tickets:", owned);
      console.log("outcomeTrue:", outcome);
      setTickets(owned);

      /* --------- Compute winning tickets (only if resolved) --------- */
      if (Number(s) === 1) {
        // ⚠️ From your logs: when outcomeTrue = false → side = 1 wins
        //                   when outcomeTrue = true  → side = 0 wins
        const winners = owned.filter((t) => {
          const didWin = outcome ? t.side === 1 : t.side === 0;
          return !t.claimed && didWin;
        });

        console.log("🏆 Winning tickets:", winners);
        setWinningTickets(winners);

        let total = 0;
        const winnersTot = outcome
          ? Number(totalTrue) / 1e6
          : Number(totalFalse) / 1e6;

        if (winnersTot > 0) {
          for (const t of winners) {
            total += (t.stake * distributable) / winnersTot;
          }
        }

        setTotalPayout(total);
        console.log("💰 Total payout =", total);
      } else {
        // if not resolved, clear previous winners
        setWinningTickets([]);
        setTotalPayout(0);
      }
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------ Claim All ------------------------------ */
  async function claimAll() {
    try {
      for (const t of winningTickets) {
        await writeContractAsync({
          address: campaignAddress,
          abi: BetCampaignABI,
          functionName: "claim",
          args: [t.id],
        });

        toast.success(`Claimed ticket #${t.id}`);
      }

      toast.success("All claims completed!");
      loadAll();
    } catch (err: any) {
      console.error("❌ Claim error:", err);
      toast.error(err?.message || "Claim failed");
    }
  }

  /* ------------------------------- Render ------------------------------- */
  if (loading) {
    return <p className="text-neutral-400">Loading claim data...</p>;
  }

  if (!address) {
    return (
      <p className="text-neutral-500">
        Connect wallet to view claim status.
      </p>
    );
  }

  if (state === null || outcomeTrue === null) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">
          Unable to load market state. Please refresh and try again.
        </p>
      </div>
    );
  }

  /* --------------------- Market state & flags --------------------- */

const now = Math.floor(Date.now() / 1000);
const isEndedByTime = endTime <= now;

// On-chain state = TRUTH
const isRunning = Number(state) === 0 && !isEndedByTime;
const isPending = Number(state) === 0 && isEndedByTime;
const isCancelled = Number(state) === 2;
const isResolved = Number(state) === 1;
console.log("🟪 RENDER FLAGS", {
  state,
  isRunning,
  isPending,
  isCancelled,
  isResolved,
});
  /* ------------------------------ NO JOIN ------------------------------ */
  if (tickets.length === 0) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">
          You did not join this prediction market.
        </p>
      </div>
    );
  }

  /* ------------------------------ RUNNING ------------------------------ */
  if (isRunning) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">
          Market is still running. Claims are not available yet.
        </p>
      </div>
    );
  }

  /* ------------------------------ PENDING ------------------------------ */
  if (isPending) {
    return (
      <div className="border border-yellow-600 p-4 rounded-lg bg-yellow-900/20">
        <p className="text-yellow-400">
          The market has ended and is awaiting resolution.
          You will be able to claim after the result is posted.
        </p>
      </div>
    );
  }

  /* ------------------------------ CANCELLED ------------------------------ */
  if (isCancelled) {
    return (
      <div className="border border-yellow-600 p-4 rounded-lg bg-yellow-900/20">
        <p className="text-yellow-400">
          This market was canceled. Refund (if any) will be available soon.
        </p>
      </div>
    );
  }

  /* ------------------ NOT RESOLVED YET (safety fallback) ------------------ */
  if (!isResolved) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">
          Waiting for result… Market not resolved yet on-chain.
        </p>
      </div>
    );
  }

  /* ------------------------------ LOST ------------------------------ */
  if (winningTickets.length === 0) {
    return (
      <div className="border border-red-600 bg-red-900/20 p-4 rounded-lg">
        <p className="text-red-400">
          Your prediction was wrong. Better luck next time.
        </p>
      </div>
    );
  }

  /* ------------------------------ WON ------------------------------ */
  return (
    <div className="border border-green-600 bg-green-900/20 p-4 rounded-lg space-y-3">
      <h3 className="text-green-300 font-semibold">🎉 You predicted correctly!</h3>

      <p className="text-neutral-300">
        Winning tickets:{" "}
        <span className="text-green-400 font-bold">{winningTickets.length}</span>
      </p>

      <p className="text-neutral-300">
        Estimated payout:{" "}
        <span className="text-green-300 font-bold">
          ${totalPayout.toFixed(2)}
        </span>
      </p>

      <button
        onClick={claimAll}
        className="w-full mt-3 py-2 rounded-md bg-green-700 hover:bg-green-600 font-medium"
      >
        Claim Rewards
      </button>
    </div>
  );
}