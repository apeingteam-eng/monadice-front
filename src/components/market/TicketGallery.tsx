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
  burned?: boolean;
};

type BackendBet = {
  ticket_id: number;
  campaign_address: string;
  side: boolean;
  stake: number;
  claimed: boolean;
  payout: number | null;
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

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

  // Removed unused 'now', 'isRunning', 'isPending' variables
  const isResolved = marketState === 1;

  /* ---------------------- LOAD FUNCTION ---------------------- */
  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);

    try {
        // 1. Fetch Backend Tickets First (Source of Truth for IDs)
        const token = localStorage.getItem("access_token");
        let backendTickets: BackendBet[] = [];
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bet/me/user-bets`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            backendTickets = json.bets.filter(
                (b: BackendBet) => b.campaign_address.toLowerCase() === campaignAddress.toLowerCase()
            );
        } catch (err) {
            console.error("Backend fetch error:", err);
        }

        if (backendTickets.length === 0) {
            setTickets([]);
            setLoading(false);
            return;
        }

        // 2. RPC Connection
        const provider = new JsonRpcProvider(CHAIN.rpcUrl);
        const contract = new Contract(campaignAddress, BetCampaignABI, provider);

        // 3. Batch Global Data
        const [outcome, totalTrue, totalFalse, totalInitialPot, feeBps] = await Promise.all([
            contract.outcomeTrue(),
            contract.totalTrue().then((n: bigint) => Number(n)/1e6),
            contract.totalFalse().then((n: bigint) => Number(n)/1e6),
            contract.totalInitialPot().then((n: bigint) => Number(n)/1e6),
            contract.feeBps().then((n: bigint) => Number(n)),
        ]);

        const pool = totalTrue + totalFalse + totalInitialPot;
        const fee = (pool * feeBps) / 10000;
        const distributable = pool - fee;

        const result: GalleryTicket[] = [];

        // 4. Iterate ONLY known backend IDs (Throttled)
        for (let i = 0; i < backendTickets.length; i++) {
            const bTicket = backendTickets[i];
            
            // Rate limiter: 50ms delay every 5 calls
            if (i > 0 && i % 5 === 0) await delay(50);

            try {
                // Try to get on-chain state
                const t = await contract.tickets(bTicket.ticket_id);
                const stake = Number(t.stake) / 1e6;
                const rawSide = t.side; 
                const side = rawSide ? 0 : 1; // 0=YES, 1=NO
                
                let won = false;
                let pnl = 0;

                if (isResolved) {
                    won = outcome ? side === 0 : side === 1;
                    if (won) {
                        const winnersTotal = outcome ? totalTrue : totalFalse;
                        pnl = winnersTotal > 0 ? (stake / winnersTotal) * distributable : 0;
                    } else {
                        pnl = -stake;
                    }
                } else {
                    const sideTotal = side === 0 ? totalTrue : totalFalse;
                    pnl = sideTotal > 0 ? (stake / sideTotal) * distributable : stake;
                }

                result.push({
                    id: bTicket.ticket_id,
                    side,
                    stake,
                    claimed: t.claimed,
                    won,
                    pnl,
                    imageUrl: t.claimed ? "/monadice_burned.png" : `/monadice${Math.min(bTicket.ticket_id, 6)}.png`,
                    burned: t.claimed,
                });
            } catch {
                // REMOVED UNUSED 'err' variable here
                // Fallback to backend data if on-chain read fails
                result.push({
                    id: bTicket.ticket_id,
                    side: bTicket.side ? 0 : 1,
                    stake: bTicket.stake,
                    claimed: bTicket.claimed,
                    won: bTicket.payout !== null && bTicket.payout > 0,
                    pnl: bTicket.payout ?? -bTicket.stake,
                    imageUrl: "/monadice_burned.png",
                    burned: true
                });
            }
        }
        
        setTickets(result);

    } catch (err) {
        console.error("Gallery Error:", err);
    } finally {
        setLoading(false);
    }
  }, [address, campaignAddress, isResolved]);

  useEffect(() => {
    if (!address) {
      setTickets([]);
      setLoading(false);
      return;
    }
    load();
  }, [load, address]);

  if (!address) return null;

  /* ------------------------------- CLAIM FUNC ------------------------------- */
  async function claimTicket(ticketId: number) {
    try {
      setClaimingId(ticketId);

      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      const contract = new Contract(campaignAddress, BetCampaignABI, provider);

      // Re-fetch specifics for safety
      const [t, outcome, totalTrue, totalFalse, totalInitialPot, feeBps] = await Promise.all([
          contract.tickets(ticketId),
          contract.outcomeTrue(),
          contract.totalTrue().then((n: bigint) => Number(n)/1e6),
          contract.totalFalse().then((n: bigint) => Number(n)/1e6),
          contract.totalInitialPot().then((n: bigint) => Number(n)/1e6),
          contract.feeBps().then((n: bigint) => Number(n)),
      ]);

      const stake = Number(t.stake) / 1e6;
      const side = Number(t.side) ? 0 : 1;
      
      const pool = totalTrue + totalFalse + totalInitialPot;
      const fee = (pool * feeBps) / 10000;
      const distributable = pool - fee;

      const winnersTot = outcome ? totalTrue : totalFalse;
      let payout = 0;
      const won = outcome ? side === 0 : side === 1; // Fixed: outcome=true means side 0 wins

      if (won && winnersTot > 0) {
        payout = (stake / winnersTot) * distributable;
      }

      const txHash = await writeContractAsync({
        address: campaignAddress,
        abi: BetCampaignABI,
        functionName: "claim",
        args: [ticketId],
      });

      toast.success(`Claim submitted for #${ticketId}`);
      const receipt = await provider.waitForTransaction(txHash, 1);

      if (!receipt || receipt.status !== 1) {
        toast.error("Transaction failed on-chain.");
        return;
      }

      // Backend Save
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
            ticket_id: ticketId,
            payout,
            tx_hash: receipt.hash,
          }),
        });
      } catch (err) { console.error(err); }

      await load();
    } catch (err: unknown) { // Changed 'any' to 'unknown'
        let msg = "Transaction failed.";
        if (err instanceof Error) {
            msg = err.message;
        } else if (typeof err === "string") {
            msg = err;
        }

        if (msg.includes("User rejected") || msg.includes("User denied")) {
            toast.error("Transaction cancelled.");
        } else {
            toast.error("Claim failed.");
            console.error(err);
        }
    } finally {
      setClaimingId(null);
    }
  }

  /* ------------------------------- UI ------------------------------- */
  if (loading) return (
      <div className="mt-10 flex justify-center text-neutral-500">
          <div className="animate-pulse flex gap-2 items-center">Loading tickets...</div>
      </div>
  );

  if (tickets.length === 0) {
    return (
      <div className="mt-10 p-8 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 text-center">
        <p className="text-neutral-500 mb-2">No tickets found.</p>
        <p className="text-xs text-neutral-600">Place a bet to participate in this market.</p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {tickets.map((t) => (
          <div
            key={t.id}
            className={`
                relative overflow-hidden group
                rounded-xl border border-neutral-800 bg-neutral-900 p-3 
                transition-all duration-300
                ${t.won && !t.claimed ? "hover:border-green-500/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "hover:border-accentPurple/40"}
            `}
          >
           <div className="relative aspect-square mb-3 overflow-hidden rounded-lg">
                <Image
                    src={t.imageUrl}
                    fill
                    alt={`Ticket #${t.id}`}
                    className={`object-cover transition-transform duration-500 group-hover:scale-110 ${t.burned ? "grayscale opacity-50" : ""}`}
                />
                
                {/* Overlay Badge */}
                <div className="absolute top-2 right-2">
                    {t.claimed ? (
                        <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10">CLAIMED</span>
                    ) : t.won && isResolved ? (
                        <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-pulse">WINNER</span>
                    ) : !isResolved ? (
                        <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">LIVE</span>
                    ) : (
                        <span className="bg-red-500/80 text-white text-[10px] font-bold px-2 py-1 rounded">LOST</span>
                    )}
                </div>
           </div>

            {/* Info Row */}
            <div className="flex justify-between items-center mb-2">
                <span className="text-neutral-500 text-xs font-mono">#{t.id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.side === 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {t.side === 0 ? "YES" : "NO"}
                </span>
            </div>

            {/* Financials */}
            <div className="bg-black/20 rounded p-2 space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">Stake</span>
                    <span className="text-neutral-300 font-medium">{t.stake} USDC</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-neutral-500">{isResolved ? "Result" : "Est. Value"}</span>
                    <span className={`font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Action Button */}
            {isResolved && t.won && !t.claimed && !t.burned && (
                <button
                  onClick={() => claimTicket(t.id)}
                  disabled={claimingId === t.id}
                  className="w-full mt-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black font-bold text-xs transition disabled:opacity-50"
                >
                  {claimingId === t.id ? "Processing..." : "Claim Payout"}
                </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}