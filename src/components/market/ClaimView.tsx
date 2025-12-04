"use client";

import { useEffect, useState, useCallback } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network";
import { useToast } from "@/components/toast/ToastContext";
import { useAccount, useWriteContract } from "wagmi";

/* ------------------------------- Types ------------------------------- */
type Ticket = {
  id: number;
  side: number; // 0 or 1
  stake: number; // in USDC (already /1e6)
  claimed: boolean;
};

type BackendBet = {
  ticket_id: number;
  claimed: boolean;
  payout: number;
  campaign_address: string;
};

type ClaimViewProps = {
  campaignAddress: `0x${string}`;
  endTime: number; // unix seconds
};

// Helper to prevent RPC throttling
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/* --------------------------- Main Component --------------------------- */
export default function ClaimView({
  campaignAddress,
  endTime,
}: ClaimViewProps) {
  const { address } = useAccount();

  const [backendBets, setBackendBets] = useState<BackendBet[]>([]);
  const [joined, setJoined] = useState<boolean>(false);
  const [claimedAmount, setClaimedAmount] = useState<number>(0);
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();

  const [loading, setLoading] = useState(true);

  // on-chain state: 0=open, 1=resolved, 2=cancelled
  const [state, setState] = useState<number | null>(null);
  const [outcomeTrue, setOutcomeTrue] = useState<boolean | null>(null);

  // Removed unused 'tickets' state
  const [winningTickets, setWinningTickets] = useState<Ticket[]>([]);
  const [totalPayout, setTotalPayout] = useState<number>(0);
  const [claiming, setClaiming] = useState(false);

  /* --------------------------- Load Function --------------------------- */
  const loadAll = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);

      // 1. Fetch Backend Bets First
      const token = localStorage.getItem("access_token");
      let backend: BackendBet[] = [];

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bet/me/user-bets`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        backend = data.bets.filter(
          (b: BackendBet) =>
            b.campaign_address.toLowerCase() === campaignAddress.toLowerCase()
        );
        
        setBackendBets(backend);
        setJoined(backend.length > 0);

        // Calculate total previously claimed from backend
        const backendClaims = backend.filter((b) => b.claimed);
        const totalClaimFromBackend = backendClaims.reduce(
          (sum, b) => sum + (b.payout || 0),
          0
        );
        setClaimedAmount(totalClaimFromBackend);
      } catch (err) {
        console.error("Failed to load backend bets:", err);
      }

      // 2. Connect to RPC
      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      const contract = new Contract(campaignAddress, BetCampaignABI, provider);

      // 3. Fetch Global Campaign Data (Single RPC calls)
      const [s, outcome, totalTrue, totalFalse, totalInitialPot, feeBps] = await Promise.all([
        contract.state(),
        contract.outcomeTrue(),
        contract.totalTrue(),
        contract.totalFalse(),
        contract.totalInitialPot(),
        contract.feeBps(),
      ]);

      const pool =
        Number(totalTrue) / 1e6 +
        Number(totalFalse) / 1e6 +
        Number(totalInitialPot) / 1e6;
      const fee = (pool * Number(feeBps)) / 10000;
      const distributable = pool - fee;

      setState(Number(s));
      setOutcomeTrue(outcome);

      // 4. Fetch User Tickets Optimized
      const owned: Ticket[] = [];
      
      for (let i = 0; i < backend.length; i++) {
        const bet = backend[i];
        
        // Rate limit protection
        if (i > 0 && i % 5 === 0) await delay(50);

        try {
          // Verify ownership on-chain
          const owner = await contract.ownerOf(bet.ticket_id);
          if (owner.toLowerCase() !== address.toLowerCase()) continue;

          // Fetch latest ticket state
          const t = await contract.tickets(bet.ticket_id);
          const rawSide = t.side;
          const side = rawSide ? 0 : 1; 

          owned.push({
            id: Number(t.id),
            side,
            stake: Number(t.stake) / 1e6,
            claimed: t.claimed,
          });
        } catch (e) {
          console.warn(`Error loading ticket ${bet.ticket_id}`, e);
        }
      }

      // Removed unnecessary setTickets(owned);

      // 5. Calculate Winnings (Only if Resolved)
      if (Number(s) === 1) {
        const winners = owned.filter((t) => {
          const didWin = outcome ? t.side === 0 : t.side === 1;
          return !t.claimed && didWin;
        });

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
      } else {
        setWinningTickets([]);
        setTotalPayout(0);
      }
    } catch (err) {
      console.error("LoadAll error:", err);
      toast.error("Failed to load market data");
    } finally {
      setLoading(false);
    }
  }, [address, campaignAddress, toast]); // endTime is strictly for render logic, mostly

  /* --------------------------- Effect --------------------------- */
  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    loadAll();
  }, [address, loadAll]);

  /* ------------------------------ Claim All ------------------------------ */
  async function claimAll() {
    try {
      setClaiming(true);
      toast.info("Processing your winning tickets…");

      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      const contract = new Contract(campaignAddress, BetCampaignABI, provider);

      // Fetch fresh totals
      const [totalTrue, totalFalse, totalInitialPot, feeBps, outcome] = await Promise.all([
        contract.totalTrue().then((n: bigint) => Number(n) / 1e6),
        contract.totalFalse().then((n: bigint) => Number(n) / 1e6),
        contract.totalInitialPot().then((n: bigint) => Number(n) / 1e6),
        contract.feeBps().then((n: bigint) => Number(n)),
        contract.outcomeTrue(),
      ]);

      const pool = totalTrue + totalFalse + totalInitialPot;
      const fee = (pool * feeBps) / 10000;
      const distributable = pool - fee;
      const winnersTot = outcome ? totalTrue : totalFalse;

      for (const t of winningTickets) {
        toast.info(`Claiming ticket #${t.id}…`);

        let tx;
        try {
          tx = await writeContractAsync({
            address: campaignAddress,
            abi: BetCampaignABI,
            functionName: "claim",
            args: [t.id],
          });
        } catch (err: unknown) {
            let msg = "Transaction failed.";
            if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === "string") {
                msg = err;
            }

            if (msg.includes("User rejected") || msg.includes("User denied")) {
                toast.error("Transaction cancelled.");
            } else {
                toast.error("Transaction failed.");
            }
            setClaiming(false);
            return;
        }

        toast.info(`Waiting for confirmation of ticket #${t.id}…`);
        const receipt = await provider.waitForTransaction(tx, 1);

        if (!receipt || receipt.status !== 1) {
          toast.error(`On-chain failure for ticket #${t.id}`);
          continue;
        }

        // Payout for backend record
        const payout = winnersTot > 0 ? (t.stake * distributable) / winnersTot : 0;

        // Save to backend
        try {
          const token = localStorage.getItem("access_token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bet/claim`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              campaign_address: campaignAddress,
              ticket_id: t.id,
              payout,
              tx_hash: receipt.hash,
            }),
          });
          toast.success(`Ticket #${t.id} claimed!`);
        } catch (err) {
          console.error("Backend save error", err);
        }
      }

      toast.success("All winning tickets claimed!");
      loadAll(); // refresh UI
    } catch (err) {
      console.error(err);
      toast.error("Claim sequence failed.");
    } finally {
      setClaiming(false);
    }
  }

  /* ------------------------------- UI RENDER ------------------------------- */

  if (!address) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400 text-center">Login to see your results.</p>
      </div>
    );
  }

  if (loading) {
    return (
        <div className="border border-neutral-800 bg-neutral-900 p-8 rounded-lg flex justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-accentPurple border-t-transparent rounded-full" />
        </div>
    );
  }

  if (state === null || outcomeTrue === null) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">Unable to load market state. Refresh.</p>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const isEndedByTime = endTime <= now;
  const isRunning = Number(state) === 0 && !isEndedByTime;
  const isPending = Number(state) === 0 && isEndedByTime;
  const isCancelled = Number(state) === 2;
  const isResolved = Number(state) === 1;

  if (!joined) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">You did not join this prediction market.</p>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
        <p className="text-neutral-400">Market is running. Results pending.</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="border border-yellow-600/30 p-4 rounded-lg bg-yellow-900/10">
        <p className="text-yellow-400 text-sm">Market ended. Waiting for resolution...</p>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="border border-yellow-600/30 p-4 rounded-lg bg-yellow-900/10">
        <p className="text-yellow-400 text-sm">Market cancelled. Refund pending.</p>
      </div>
    );
  }

  if (!isResolved) {
    return <div className="p-4 text-neutral-400 bg-neutral-900 rounded-lg">Loading result...</div>;
  }

  /* --- Logic for Partial Claims --- */
  const backendClaims = backendBets.filter((b) => b.claimed);
  const unclaimedWins = winningTickets.filter((t) => 
     !backendClaims.some(b => b.ticket_id === t.id)
  );
  
  // Case: User won, but has mixed status (some claimed, some not)
  if (backendClaims.length > 0 && unclaimedWins.length > 0) {
    const remainingPayout = totalPayout; 
    const claimedPayout = claimedAmount;
    const totalCombined = claimedPayout + remainingPayout;

    return (
      <div className="border border-accentPurple/40 bg-accentPurple/5 p-5 rounded-lg space-y-4 shadow-lg shadow-accentPurple/5">
        <h3 className="text-accentPurple text-lg font-bold">Unclaimed Rewards Found</h3>
        <div className="text-sm text-neutral-300 space-y-1">
          <p>Already Claimed: <span className="text-green-400 font-mono">${claimedPayout.toFixed(2)}</span></p>
          <p>Remaining: <span className="text-accentPurple font-mono font-bold">${remainingPayout.toFixed(2)}</span></p>
          <p className="pt-2 border-t border-white/5 mt-2">Total Earnings: <span className="text-white font-bold">${totalCombined.toFixed(2)}</span></p>
        </div>
        <button
          onClick={claimAll}
          disabled={claiming}
          className="w-full py-2.5 mt-2 rounded-lg bg-accentPurple hover:bg-accentPurple/80 text-white font-bold transition disabled:opacity-50"
        >
          {claiming ? "Processing..." : "Claim Remaining"}
        </button>
      </div>
    );
  }

  // Case: All wins already claimed
  if (backendClaims.length > 0 && winningTickets.length === 0) {
    return (
      <div className="border border-green-500/30 bg-green-500/5 p-5 rounded-lg space-y-2">
        <h3 className="text-green-400 text-lg font-bold">Rewards Claimed 🎉</h3>
        <p className="text-sm text-neutral-400">
           Total Payout: <span className="text-white font-bold">${claimedAmount.toFixed(2)}</span>
        </p>
        <p className="text-xs text-neutral-500">
           Tickets: {backendClaims.map(b => `#${b.ticket_id}`).join(", ")}
        </p>
      </div>
    );
  }

  // Case: Nothing to claim (Lost)
  if (winningTickets.length === 0) {
    return (
      <div className="border border-red-500/20 bg-red-900/10 p-4 rounded-lg text-center">
        <p className="text-red-400 font-medium">Prediction Incorrect</p>
        <p className="text-xs text-red-400/60 mt-1">Better luck next time!</p>
      </div>
    );
  }

  // Case: Has wins, none claimed yet
  return (
    <div className="border border-accentPurple/40 bg-accentPurple/5 p-5 rounded-lg space-y-4 shadow-lg shadow-accentPurple/5">
      <h3 className="text-accentPurple text-lg font-bold flex items-center gap-2">
        <span className="text-xl">🏆</span> You Won!
      </h3>
      <div className="space-y-1 text-neutral-300 text-sm">
        <p>Winning Tickets: <span className="text-white font-bold">{winningTickets.length}</span></p>
        <p>Total Payout: <span className="text-accentPurple font-bold text-lg">${totalPayout.toFixed(2)}</span></p>
      </div>
      <button
        onClick={claimAll}
        disabled={claiming}
        className="w-full py-2.5 mt-2 rounded-lg bg-accentPurple hover:bg-accentPurple/80 text-white font-bold transition disabled:opacity-50"
      >
        {claiming ? "Claiming..." : "Claim Rewards"}
      </button>
    </div>
  );
}