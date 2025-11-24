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

type BackendBet = {
  ticket_id: number;
  claimed: boolean;
  payout: number;
  campaign_address: string;
};

type ClaimViewProps = {
  campaignAddress: `0x${string}`;
  endTime: number;        // unix seconds
};

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

  // on-chain state: 0=open, 1=resolved, 2=cancelled (from your contract)
  const [state, setState] = useState<number | null>(null);
  const [outcomeTrue, setOutcomeTrue] = useState<boolean | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [winningTickets, setWinningTickets] = useState<Ticket[]>([]);
  const [totalPayout, setTotalPayout] = useState<number>(0);
const [claiming, setClaiming] = useState(false);
  /* --------------------------- Load All Data --------------------------- */
useEffect(() => {
  if (!address) {
    setLoading(false); // ⛔ make sure loading stops if not logged in
    return;
  }
  loadAll();
}, [campaignAddress, address]);
  async function loadAll() {
    if (!address) return;

    try {
      setLoading(true);
// ---- Load backend bets first ----
const token = localStorage.getItem("access_token");

let backend: BackendBet[] = [];
try {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/bet/me/user-bets`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const data = await res.json();

  backend = data.bets.filter(
    (b: BackendBet) =>
      b.campaign_address.toLowerCase() === campaignAddress.toLowerCase()
  );

  setBackendBets(backend);
  setJoined(backend.length > 0);

  // --- calculate total claimed payout ---
  const backendClaims = backend.filter((b: BackendBet) => b.claimed);
 const totalClaimFromBackend = backendClaims.reduce(
  (sum: number, b: BackendBet) => sum + (b.payout || 0),
  0
);
  setClaimedAmount(totalClaimFromBackend);

} catch (err) {
  console.error("Failed to load backend bets:", err);
}
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

          const rawSide = t.side;        // boolean from contract
const side = rawSide ? 0 : 1;  // true → YES → 0, false → NO → 1

owned.push({
  id: Number(t.id),
  side,
  stake: Number(t.stake) / 1e6,
  claimed: t.claimed,
});
          console.log(`Ticket ${Number(t.id)} FE says win= side=${Number(t.side)}`);
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
  const didWin = outcome ? t.side === 0 : t.side === 1;  
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
 /* ------------------------------ Claim All ------------------------------ */
async function claimAll() {
  try {
    setClaiming(true);
    toast.info("Processing your winning tickets…");

    const provider = new JsonRpcProvider(CHAIN.rpcUrl);
    const contract = new Contract(campaignAddress, BetCampaignABI, provider);

    const totalTrue = Number(await contract.totalTrue()) / 1e6;
    const totalFalse = Number(await contract.totalFalse()) / 1e6;
    const totalInitialPot = Number(await contract.totalInitialPot()) / 1e6;
    const feeBps = Number(await contract.feeBps());

    const pool = totalTrue + totalFalse + totalInitialPot;
    const fee = (pool * feeBps) / 10000;
    const distributable = pool - fee;

    const winnersTot = outcomeTrue ? totalTrue : totalFalse;

    for (const t of winningTickets) {
      toast.info(`Claiming ticket #${t.id}…`);

      // 1️⃣ SEND TX
      let tx;
      try {
        tx = await writeContractAsync({
          address: campaignAddress,
          abi: BetCampaignABI,
          functionName: "claim",
          args: [t.id],
        });
      } catch (err) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown error";

       const userCancelled =
    msg.includes("User rejected") ||
    msg.includes("User denied") ||
    msg.includes("ACTION_REJECTED") ||
    msg.includes("RejectedByUser");

        if (userCancelled) {
          toast.error("Transaction cancelled by user.");
        } else {
          toast.error("Transaction failed.");
        }

        setClaiming(false);
        return;
      }

      toast.info(`Waiting for confirmation of ticket #${t.id}…`);

      // 2️⃣ WAIT FOR CONFIRMATION
      const receipt = await provider.waitForTransaction(tx, 1);

      if (!receipt || receipt.status !== 1) {
        toast.error(`On-chain failure for ticket #${t.id}`);
        continue;
      }

      // 3️⃣ Compute payout
      const payout =
        winnersTot > 0 ? (t.stake * distributable) / winnersTot : 0;

      // 4️⃣ SAVE CLAIM IN BACKEND
      try {
        const token = localStorage.getItem("access_token");

        const save = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bet/claim`,
          {
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
          }
        );

        if (!save.ok) {
          toast.error(`Saved on-chain but backend failed (#${t.id}).`);
        } else {
          toast.success(`Ticket #${t.id} claimed!`);
        }
      } catch (err) {
        console.error(err);
        toast.error(`Backend error for #${t.id}`);
      }
    }

    toast.success("All winning tickets claimed!");
    loadAll();
  } catch (err) {
    console.error(err);
    toast.error("Claim failed.");
  } finally {
    setClaiming(false);
  }
}
// 1️⃣ User not logged in → show login notice, not loading
if (!address) {
  return (
    <div className="border border-neutral-700 bg-neutral-900 p-4 rounded-lg">
      <p className="text-neutral-400 text-center">
        Login to see your results.
      </p>
    </div>
  );
}

// 2️⃣ Loading only when connected
if (loading) {
  return <p className="text-neutral-400">Loading claim data...</p>;
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
 if (!joined) {
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
// ---- USER ALREADY CLAIMED (backend tells the truth) ----
/* ---------------------------------------
   CASE 2: Some claimed, some unclaimed
---------------------------------------- */

const backendClaims = backendBets.filter((b) => b.claimed);
const unclaimedWins = winningTickets.filter((t) =>
  !backendClaims.some((b) => b.ticket_id === t.id)
);

if (backendClaims.length > 0 && unclaimedWins.length > 0) {
  const remainingPayout = totalPayout;             // unclaimed value
  const claimedPayout = claimedAmount;             // from backend
  const totalCombined = claimedPayout + remainingPayout;

  return (
    <div className="border border-accentPurple/60 bg-accentPurple/10 p-5 rounded-lg space-y-5 shadow-[0_0_20px_rgba(155,93,229,0.25)]">

      <h3 className="text-accentPurple text-lg font-semibold">
        You have unclaimed rewards!
      </h3>

      {/* CLAIMED SECTION */}
      <div className="text-sm text-neutral-300 space-y-1">
        <p>
          <span className="text-neutral-500">Already claimed:</span>{" "}
          <span className="font-mono text-neutral-300">
            {backendClaims.map((b) => `#${b.ticket_id}`).join(", ")}
          </span>
        </p>

        <p>
          Claimed payout:{" "}
          <span className="text-green-400 font-semibold">
            ${claimedPayout.toFixed(2)}
          </span>
        </p>
      </div>

      {/* UNCLAIMED SECTION */}
      <div className="text-sm text-neutral-300 space-y-1">
        <p>
          <span className="text-neutral-500">Unclaimed tickets:</span>{" "}
          <span className="font-mono text-accentPurple font-bold">
            {unclaimedWins.map((t) => `#${t.id}`).join(", ")}
          </span>
        </p>

        <p>
          Remaining payout:{" "}
          <span className="text-accentPurple font-bold">
            ${remainingPayout.toFixed(2)}
          </span>
        </p>

        {/* OPTIONAL: per-ticket payout */}
        <div className="mt-1 text-xs text-neutral-400">
          {unclaimedWins.map((t) => (
            <p key={t.id}>
              Ticket #{t.id}:{" "}
              <span className="text-accentPurple">
                ${(
                  (t.stake * (remainingPayout / t.stake)) /
                  unclaimedWins.length
                ).toFixed(2)}
              </span>
            </p>
          ))}
        </div>
      </div>

      {/* TOTAL */}
      <div className="text-sm text-neutral-300">
        Total earned (claimed + remaining):{" "}
        <span className="text-accentPurple font-bold">
          ${totalCombined.toFixed(2)}
        </span>
      </div>

      <button
  onClick={claimAll}
  disabled={claiming}
  className={`
    w-full py-2 mt-2 rounded-md
    text-white font-medium
    transition
    ${claiming
      ? "bg-accentPurple/50 cursor-not-allowed"
      : "bg-accentPurple hover:bg-accentPurple/80"
    }
  `}
>
  {claiming ? "Claiming…" : "Claim Remaining Rewards"}
</button>
        
      
    </div>
  );
}
  /* ------------------------------ FULLY CLAIMED ------------------------------ */
  // If user had winning tickets but all of them are already claimed (backend truth)
  if (backendClaims.length > 0 && winningTickets.length === 0) {
    const totalClaimed = claimedAmount; // already claimed from backend

    return (
      <div className="border border-accentPurple/60 bg-accentPurple/10 p-5 rounded-lg space-y-4 shadow-[0_0_20px_rgba(155,93,229,0.25)]">
        <h3 className="text-accentPurple text-lg font-semibold">
          You already claimed your rewards 🎉
        </h3>

        <div className="text-sm text-neutral-300 space-y-1">
          <p>
            Claimed tickets:{" "}
            <span className="font-mono text-accentPurple font-semibold">
              {backendClaims.map((b) => `#${b.ticket_id}`).join(", ")}
            </span>
          </p>

          <p>
            Total payout:{" "}
            <span className="text-green-400 font-bold">
              ${totalClaimed.toFixed(2)}
            </span>
          </p>
        </div>
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

 /* ------------------------------ WON (purple themed) ------------------------------ */
if (winningTickets.length > 0) {
  return (
    <div className="border border-accentPurple/60 bg-accentPurple/10 p-5 rounded-lg space-y-4 shadow-[0_0_20px_rgba(155,93,229,0.25)]">
      <h3 className="text-accentPurple text-lg font-semibold flex items-center gap-2">
      Your prediction is correct!
      </h3>

      <div className="space-y-1 text-neutral-300 text-sm">
        <p>
          Winning tickets:{" "}
          <span className="text-accentPurple font-bold">
            {winningTickets.length}
          </span>
        </p>

        {/* 🟣 SHOW WINNING TICKET IDS */}
        <p>
          Ticket IDs:{" "}
          <span className="font-mono text-accentPurple font-semibold">
            {winningTickets.map((t) => `#${t.id}`).join(", ")}
          </span>
        </p>

        <p>
          Estimated payout:{" "}
          <span className="text-accentPurple font-bold">
            ${totalPayout.toFixed(2)}
          </span>
        </p>
      </div>

      <button
  onClick={claimAll}
  disabled={claiming}
  className={`
    w-full py-2 mt-2 rounded-md
    text-white font-medium
    transition
    ${claiming
      ? "bg-accentPurple/50 cursor-not-allowed"
      : "bg-accentPurple hover:bg-accentPurple/80"
    }
  `}
>
  {claiming ? "Claiming…" : "Claim Rewards"}
</button>
    </div>
  );
}
}