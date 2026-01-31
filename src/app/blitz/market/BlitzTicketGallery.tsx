"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useToast } from "@/components/toast/ToastContext";

import { BrowserProvider, Contract } from "ethers";
import type { Eip1193Provider } from "ethers";
import { useWalletClient } from "wagmi";
import BlitzBetCampaignABI from "@/lib/ethers/abi/BlitzBetCampaign.json";

/* ------------------------------------------------------------
   TYPES
------------------------------------------------------------ */
type BlitzTicket = {
    id: number;
    ticket_id: number;
    campaign_address: string;
    user_wallet: string;
    outcome: number; // Index of the outcome
    amount: number;
    claimed: boolean;
    market_id: number;
};

type Props = {
    currentCampaignAddress?: string; // Optional: filter by this campaign
    outcomes?: string[]; // To display outcome name
    winningOutcome?: number | null; // To highlight winning tickets
    refreshTrigger?: number;
};

/* ------------------------------------------------------------
   COMPONENT
------------------------------------------------------------ */
export default function BlitzTicketGallery({ currentCampaignAddress, outcomes, winningOutcome, refreshTrigger }: Props) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const toast = useToast();
    const [tickets, setTickets] = useState<BlitzTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<number | null>(null);

    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const isResolved = winningOutcome !== null && winningOutcome !== undefined;

    useEffect(() => {
        if (!address || !accessToken) {
            setLoading(false);
            return;
        }

        async function fetchTickets() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/my-tickets`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (!res.ok) throw new Error("Failed to fetch tickets");

                const data = await res.json();
                // Expect { status: "success", count: 1, tickets: [...] }
                if (data.status === "success" && Array.isArray(data.tickets)) {
                    let allTickets = data.tickets as BlitzTicket[];

                    // Filter if campaign address provided
                    if (currentCampaignAddress) {
                        allTickets = allTickets.filter(
                            (t) => t.campaign_address.toLowerCase() === currentCampaignAddress.toLowerCase()
                        );
                    }

                    setTickets(allTickets);
                }
            } catch (err) {
                console.error("Error fetching blitz tickets:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchTickets();
    }, [address, accessToken, currentCampaignAddress, claimingId, refreshTrigger]); // Refresh on claim


    const handleClaim = async (ticket: BlitzTicket) => {
        if (!walletClient || !address) return toast.error("Wallet not connected");

        try {
            setClaimingId(ticket.id);
            // toast.info(`Processing ticket #${ticket.ticket_id}...`);

            const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
            const signer = await provider.getSigner(address);
            const contract = new Contract(ticket.campaign_address, BlitzBetCampaignABI, signer);

            // 1. Check Approval (setApprovalForAll)
            // Use try-catch for isApprovedForAll as it might fail on some non-standard implementations, 
            // though BlitzBetCampaign should support it now.
            let isApproved = false;
            try {
                isApproved = await contract.isApprovedForAll(address, ticket.campaign_address);
            } catch (e) {
                console.warn("isApprovedForAll check failed, assuming false to be safe", e);
                isApproved = false;
            }

            if (!isApproved) {
                toast.info("One-time approval required. Please sign...");
                const approveTx = await contract.setApprovalForAll(ticket.campaign_address, true);
                await approveTx.wait();
                toast.success("Approved! Proceeding to claim...");
            }

            // 2. Claim
            toast.info(`Claiming ticket #${ticket.ticket_id}...`);
            const tx = await contract.claim(ticket.ticket_id);
            const receipt = await tx.wait();

            if (!receipt || receipt.status !== 1) {
                throw new Error("Transaction failed on-chain");
            }

            toast.success("Payout claimed on-chain!");

            // 3. Backend Sync
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/claim`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    campaign_address: ticket.campaign_address,
                    ticket_id: ticket.ticket_id,
                }),
            });

            // Update local state
            setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, claimed: true } : t));

        } catch (err: any) {
            console.error("Claim Error:", err);
            const isRejected = err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001 || err.message?.includes("user denied") || err.message?.includes("User denied");
            if (isRejected) toast.error("User cancelled transaction");
            else toast.error(err.reason || err.message || "Claim failed");
        } finally {
            setClaimingId(null);
        }
    };


    if (!address || !accessToken) return null;
    if (!loading && tickets.length === 0) return null;

    return (
        <div className="w-full mt-10 animate-in fade-in duration-700">
            <div className="flex items-center gap-3 mb-6">
                <h3 className="text-xl font-bold text-white">Recent Activity</h3>
                <span className="bg-neutral-800 text-neutral-400 text-xs px-2 py-0.5 rounded-full border border-neutral-700">
                    {tickets.length} tickets
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {loading ? (
                    // Skeleton
                    [1, 2, 3, 4].map(i => <div key={i} className="aspect-[3/4] rounded-xl bg-neutral-900/50 animate-pulse border border-neutral-800" />)
                ) : (
                    tickets.map((ticket) => {
                        const outcomeName = outcomes && outcomes[ticket.outcome] ? outcomes[ticket.outcome] : `Outcome #${ticket.outcome + 1}`;
                        const imageUrl = `/monadice${Math.min(ticket.ticket_id % 6, 6)}.png`;

                        // Status Logic
                        let isWinner = false;
                        let isLoser = false;

                        if (isResolved) {
                            if (ticket.outcome === winningOutcome) {
                                isWinner = true;
                            } else {
                                isLoser = true;
                            }
                        }

                        const isProcessing = claimingId === ticket.id;

                        return (
                            <div
                                key={ticket.id}
                                className={`
                                    group relative overflow-hidden rounded-xl border p-3 transition-all duration-300
                                    ${isWinner && !ticket.claimed ? "border-green-500/50 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)] hover:-translate-y-1" :
                                        isLoser ? "border-neutral-800 bg-neutral-900/50 opacity-75 hover:opacity-100" :
                                            "border-neutral-800 bg-neutral-900 hover:border-accentPurple/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-accentPurple/10"}
                                `}
                            >
                                {/* Image Container */}
                                <div className="relative aspect-square mb-3 overflow-hidden rounded-lg bg-[#1a1a1a]">
                                    <img
                                        src={imageUrl}
                                        alt={`Ticket #${ticket.ticket_id}`}
                                        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 
                                            ${ticket.claimed || isLoser ? "grayscale opacity-50" : ""}
                                        `}
                                    />

                                    {/* Status Badge */}
                                    <div className="absolute top-2 right-2">
                                        {ticket.claimed ? (
                                            <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10">CLAIMED</span>
                                        ) : isWinner ? (
                                            <span className="bg-green-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-pulse">WON</span>
                                        ) : isLoser ? (
                                            <span className="bg-neutral-700/80 text-white text-[10px] font-bold px-2 py-1 rounded">LOST</span>
                                        ) : (
                                            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">LIVE</span>
                                        )}
                                    </div>

                                    {/* Overlay Buttons for Winners */}
                                    {isWinner && !ticket.claimed && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 gap-2 p-4 text-center">

                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleClaim(ticket); }}
                                                disabled={isProcessing}
                                                className="w-full px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold text-xs rounded-full shadow-[0_0_15px_rgba(34,197,94,0.4)] transform hover:scale-105 transition-all"
                                            >
                                                {isProcessing ? "Processing..." : "Claim Payout"}
                                            </button>

                                            <span className="text-[10px] text-neutral-400 font-medium">
                                                Click to claim winnings
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Info Row: Ticket ID & Outcome */}
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-neutral-500 text-xs font-mono">#{ticket.ticket_id}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border truncate max-w-[120px] 
                                        ${isWinner ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                            isLoser ? "bg-neutral-800 text-neutral-500 border-neutral-700" :
                                                "bg-neutral-800 text-white border-neutral-700"}`}>
                                        {outcomeName}
                                    </span>
                                </div>

                                {/* Financials Box */}
                                <div className="bg-black/20 rounded p-2 space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-neutral-500">Stake</span>
                                        <span className="text-neutral-300 font-medium">{ticket.amount > 0 ? `${ticket.amount} MON` : "0 MON"}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-neutral-500">Result</span>
                                        {isWinner ? (
                                            <span className="text-green-400 font-bold flex items-center gap-1">
                                                WIN <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            </span>
                                        ) : isLoser ? (
                                            <span className="text-neutral-500 font-medium">LOSS</span>
                                        ) : (
                                            <span className="text-blue-400 font-medium">PENDING</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
