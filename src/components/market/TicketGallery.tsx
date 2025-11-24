"use client";

import { useEffect, useState, useCallback } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import Image from "next/image";
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network";
import { useToast } from "@/components/toast/ToastContext";
import { useAccount, useWriteContract } from "wagmi";

type GalleryTicket = {
  id: number;
  side: number;
  stake: number;
  claimed: boolean;
  won: boolean;
  pnl: number;
  imageUrl: string;
  burned?: boolean; // <--- add this
};

type BackendBet = {
  ticket_id: number;
  campaign_address: string;
  side: boolean;
  stake: number;
  claimed: boolean;
  payout: number | null;
};

export default function TicketGallery({
  campaignAddress,
  endTime,
  state: marketState,
}: {
  campaignAddress: `0x${string}`;
  endTime: number;
  state: number;
}) {
  const { address } = useAccount();
  const toast = useToast();
  const { writeContractAsync } = useWriteContract();

  const [tickets, setTickets] = useState<GalleryTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const now = Math.floor(Date.now() / 1000);
  const isRunning = marketState === 0 && endTime > now;
  const isPending = marketState === 0 && endTime <= now;
  const isResolved = marketState === 1;

  /* ---------------------- LOAD FUNCTION (fix React warning) ---------------------- */
  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
// --- 1) Fetch backend historic tickets for this campaign ---
const token = localStorage.getItem("access_token");

let backendTickets: BackendBet[] = [];
try {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/bet/me/user-bets`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const json = await res.json();
  backendTickets = json.bets.filter(
    (b: BackendBet) =>
      b.campaign_address.toLowerCase() === campaignAddress.toLowerCase()
  );
} catch (err) {
  console.error("Failed to load backend tickets:", err);
}
    try {
      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      const contract = new Contract(campaignAddress, BetCampaignABI, provider);

      const nextId = Number(await contract.nextTicketId());
      const outcome = await contract.outcomeTrue();

      const tTrue = Number(await contract.totalTrue()) / 1e6;
      const tFalse = Number(await contract.totalFalse()) / 1e6;
      const tPot = Number(await contract.totalInitialPot()) / 1e6;
      const fBps = Number(await contract.feeBps());

      const pool = tTrue + tFalse + tPot;
      const fee = (pool * fBps) / 10000;
      const distributable = pool - fee;

      const result: GalleryTicket[] = [];

      for (let i = 1; i < nextId; i++) {
  try {
    const owner = await contract.ownerOf(i);
    if (owner.toLowerCase() !== address.toLowerCase()) continue;

    const t = await contract.tickets(i);
    const stake = Number(t.stake) / 1e6;

    // --- FIXED SIDE MAPPING ---
    const rawSide = t.side;       // boolean
    const side = rawSide ? 0 : 1; // true=yes →0, false=no →1

    let won = false;
    let pnl = 0;

    if (isResolved) {
      // --- FIXED WIN LOGIC ---
      won = outcome ? side === 0 : side === 1;

      if (won) {
        const winnersTotal = outcome ? tTrue : tFalse;
        pnl = winnersTotal > 0 ? (stake / winnersTotal) * distributable : 0;
      } else {
        pnl = -stake;
      }
    } else {
      const isSideTrue = side === 0;
      const sideTotal = isSideTrue ? tTrue : tFalse;
      pnl = sideTotal > 0 ? (stake / sideTotal) * distributable : stake;
    }

    result.push({
  id: i,
  side,
  stake,
  claimed: t.claimed,
  won,
  pnl,
  imageUrl: t.claimed ? "/monadice_burned.png" : (i <= 6 ? `/monadice${i}.png` : `/monadice6.png`),
  burned: t.claimed,   // 🔥 mark claimed tickets as burned
});
  } catch {
    /* ignore missing tickets */
  }
}
     // --- 2) Merge on-chain + backend (to include burned/claimed historic tickets) ---
const merged: GalleryTicket[] = [];

// 2A — Add on-chain tickets normally
for (const t of result) merged.push(t);

// 2B — Add tickets that exist in backend but NOT on-chain (burned or old tickets)
backendTickets.forEach((b: BackendBet) => {
  const exists = result.some((t: GalleryTicket) => t.id === b.ticket_id);
  if (!exists) {
    merged.push({
      id: b.ticket_id,
      side: b.side ? 0 : 1, // backend side = boolean
      stake: b.stake,
      claimed: b.claimed,
      won: b.payout !== null && b.payout > 0,
      pnl: b.payout !== null ? b.payout : -b.stake,
      imageUrl: "/monadice_burned.png",
      burned: true,
    });
  }
});

// Final list
setTickets(merged);
    } finally {
      setLoading(false);
    }
  }, [address, campaignAddress, isResolved]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------- CLAIM FUNC ------------------------------- */
 async function claimTicket(ticketId: number) {
  try {
    setClaimingId(ticketId);

    const provider = new JsonRpcProvider(CHAIN.rpcUrl);
    const contract = new Contract(campaignAddress, BetCampaignABI, provider);

    // 1) READ ON-CHAIN VALUES
    const t = await contract.tickets(ticketId);
    const stake = Number(t.stake) / 1e6;
    const side = Number(t.side);

    const tTrue = Number(await contract.totalTrue()) / 1e6;
    const tFalse = Number(await contract.totalFalse()) / 1e6;
    const tPot = Number(await contract.totalInitialPot()) / 1e6;
    const fBps = Number(await contract.feeBps());
    const outcome = await contract.outcomeTrue();

    const pool = tTrue + tFalse + tPot;
    const fee = (pool * fBps) / 10000;
    const distributable = pool - fee;

    const winnersTot = outcome ? tTrue : tFalse;

    let payout = 0;
    const won = outcome ? side === 1 : side === 0;

    if (won && winnersTot > 0) {
      payout = (stake / winnersTot) * distributable;
    }

    // -------------------------------
    // 2) SEND CLAIM TX
    // -------------------------------
    const txHash = await writeContractAsync({
      address: campaignAddress,
      abi: BetCampaignABI,
      functionName: "claim",
      args: [ticketId],
    });

    toast.success(`Claim submitted for ticket #${ticketId}`);

    // -------------------------------
    // 3) WAIT FOR TRANSACTION CONFIRMATION
    // -------------------------------
    const receipt = await provider.waitForTransaction(txHash, 1);

    if (!receipt || receipt.status !== 1) {
      toast.error("Transaction failed on-chain.");
      return;
    }

    // -------------------------------
    // 4) SAVE CLAIM TO BACKEND
    // -------------------------------
    try {
      const token = localStorage.getItem("access_token");

      const saveRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/bet/claim`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            campaign_address: campaignAddress,
            ticket_id: ticketId,
            payout,
            tx_hash: receipt.hash, // ethers v6
          }),
        }
      );

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        console.error("Backend claim error:", errText);
        toast.error(`Could not save claim for #${ticketId}`);
      }
    } catch (err) {
      console.error("Error saving claim to backend:", err);
    }

    await load();
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
    msg.includes("RejectedByUser") ||
    msg.includes("User canceled") ||
    (err instanceof Error && err.name === "UserRejectedRequestError");

  if (userCancelled) {
    toast.error("Transaction cancelled by user.");
  } else {
    toast.error("Claim failed. Please try again.");
    console.error("Claim error:", err);
  }
} finally {
  setClaimingId(null);
}
}
  /* ------------------------------- UI ------------------------------- */

  if (loading) return <p className="text-neutral-400">Loading tickets...</p>;

  if (tickets.length === 0) {
    return (
      <div className="mt-10 p-5 rounded-xl border border-neutral-800 bg-neutral-900 text-center text-neutral-400">
        You don&apos;t have any bets in this market.
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h2 className="text-xl font-semibold mb-4">All Tickets</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tickets.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 hover:border-accentPurple/40 transition"
          >
           <Image
  src={t.imageUrl}
  width={400}
  height={400}
  alt="ticket image"
  className={`w-full h-64 object-cover rounded-lg mb-3 ${
    t.burned ? "opacity-40 grayscale" : ""
  }`}
/>

            {/* ID + SIDE + STATUS */}
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 text-xs">#{t.id}</span>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                    ${
                      t.side === 0
                        ? "bg-accentPurple/20 text-accentPurple"
                        : "bg-accentPurple/20 text-accentPurple"
                    }`}
                >
                  {t.side === 0 ? "YES" : "NO"}
                </span>
              </div>

              {isResolved ? (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    t.claimed
                      ? "bg-neutral-700 text-neutral-300"
                      : t.won
                      ? "bg-green-600/20 text-green-400"
                      : "bg-red-600/20 text-red-400"
                  }`}
                >
                  {t.claimed ? "CLAIMED" : t.won ? "WIN" : "LOSS"}
                </span>
              ) : isRunning ? (
                <span className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400">
                  LIVE
                </span>
              ) : isPending ? (
                <span className="text-xs px-2 py-1 rounded bg-yellow-600/20 text-yellow-400">
                  PENDING
                </span>
              ) : null}
            </div>

            {/* Stake */}
            <p className="text-neutral-300 text-sm">
              Stake: <span className="font-medium">{t.stake} USDC</span>
            </p>

            {/* PnL / Potential */}
            <div className="flex items-center justify-between mt-1">
              <p className="text-neutral-300 text-sm">
                {isResolved ? "PnL:" : "Potential:"}{" "}
                <span
                  className={
                    t.pnl >= 0
                      ? "text-green-400 font-bold"
                      : "text-red-400 font-bold"
                  }
                >
                  {t.pnl >= 0 ? "+" : ""}
                  {t.pnl.toFixed(2)} USDC
                </span>
              </p>

          {isResolved && t.won && !t.claimed && !t.burned && (
                <button
                  onClick={() => claimTicket(t.id)}
                  disabled={claimingId === t.id}
                  className="py-1 px-3 rounded-md bg-accentPurple hover:bg-accentPurple/70 text-white text-xs font-medium disabled:opacity-50"
                >
                  {claimingId === t.id ? "Claiming…" : "Claim"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}