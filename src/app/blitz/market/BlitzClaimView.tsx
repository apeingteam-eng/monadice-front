"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import type { Eip1193Provider } from "ethers";
import { useToast } from "@/components/toast/ToastContext";
import BlitzBetCampaignABI from "@/lib/ethers/abi/BlitzBetCampaign.json";
import { CHAIN } from "@/config/network";

type Props = {
    campaignAddress: string;
    winningOutcome: number | null; // Index of winning outcome
    outcomes: string[];
    betToken: string; // To check if native or ERC20 (mostly for display units)
};

export default function BlitzClaimView({ campaignAddress, winningOutcome, outcomes, betToken }: Props) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const toast = useToast();

    const [loading, setLoading] = useState(false);
    const [winningTickets, setWinningTickets] = useState<any[]>([]);
    const [losingTickets, setLosingTickets] = useState<any[]>([]);
    const [scanLoading, setScanLoading] = useState(false);

    // Batch Claim State
    const [isApprovedForAll, setIsApprovedForAll] = useState(false);
    const [claimAllLoading, setClaimAllLoading] = useState(false);
    const [claimedCount, setClaimedCount] = useState(0);

    // Connect to Contract
    const [contract, setContract] = useState<Contract | null>(null);

    useEffect(() => {
        async function init() {
            if (!walletClient || !address) return;
            const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
            const signer = await provider.getSigner(address);
            const c = new Contract(campaignAddress, BlitzBetCampaignABI, signer);
            setContract(c);

            // Check Approval
            try {
                // If the contract requires approval to burn/claim tokens from the user
                // We assume the operator is the campaign address itself (often implied or explicit)
                // However, standard ERC721 burn often doesn't need approval if OWNER calls it.
                // But user demanded approval step, so we implement it.
                const approved = await c.isApprovedForAll(address, campaignAddress);
                setIsApprovedForAll(approved);
            } catch (e) {
                console.warn("Approval check failed (might not be needed for this contract)", e);
                // Assume approved if check fails to avoid blocking UI if method missing
                setIsApprovedForAll(true);
            }
        }
        init();
    }, [walletClient, address, campaignAddress]);

    // Scan User Tickets
    useEffect(() => {
        async function scanTickets() {
            if (!address || winningOutcome === null) return;

            setScanLoading(true);
            try {
                // Fetch tickets from backend to get IDs quickly
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/my-tickets`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
                });
                const data = await res.json();

                if (data.status === "success" && data.tickets) {
                    const myTickets = data.tickets.filter((t: any) =>
                        t.campaign_address.toLowerCase() === campaignAddress.toLowerCase()
                    );

                    const winners = [];
                    const losers = [];

                    for (const t of myTickets) {
                        if (t.outcome === winningOutcome) {
                            winners.push(t);
                        } else {
                            losers.push(t);
                        }
                    }
                    setWinningTickets(winners);
                    setLosingTickets(losers);
                }
            } catch (err) {
                console.error("Error scanning tickets:", err);
            } finally {
                setScanLoading(false);
            }
        }

        scanTickets();
    }, [address, campaignAddress, winningOutcome]);

    /* ------------------------------------------------------------
       HANDLERS
    ------------------------------------------------------------ */
    const handleClaimAll = async () => {
        if (!contract) return;
        const unclaimed = winningTickets.filter(t => !t.claimed);
        if (unclaimed.length === 0) return;

        setClaimAllLoading(true);
        setClaimedCount(0);

        try {
            // 1. Approve All if needed
            if (!isApprovedForAll) {
                toast.info("Please approve all tickets for claiming...");
                const tx = await contract.setApprovalForAll(campaignAddress, true);
                await tx.wait();
                setIsApprovedForAll(true);
                toast.success("Approval successful!");
            }

            // 2. Loop Claim
            for (let i = 0; i < unclaimed.length; i++) {
                const ticket = unclaimed[i];
                toast.info(`Claiming ticket #${ticket.ticket_id} (${i + 1}/${unclaimed.length})...`);

                try {
                    const tx = await contract.claim(ticket.ticket_id);
                    const receipt = await tx.wait();
                    if (!receipt || receipt.status !== 1) throw new Error("Tx failed");

                    // Backend Sync
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/claim`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                        },
                        body: JSON.stringify({
                            campaign_address: campaignAddress,
                            ticket_id: ticket.ticket_id,
                        }),
                    });

                    // Update UI immediately for this item
                    setWinningTickets(prev => prev.map(t => t.ticket_id === ticket.ticket_id ? { ...t, claimed: true } : t));
                    setClaimedCount(prev => prev + 1);

                } catch (err: any) {
                    // Check rejection
                    const isRejected = err.code === "ACTION_REJECTED" || err.message?.includes("user denied");
                    if (isRejected) {
                        toast.error("Process paused: User rejected.");
                        break; // Stop loop on rejection
                    } else {
                        console.error(`Failed to claim ticket ${ticket.ticket_id}`, err);
                        toast.error(`Ticket #${ticket.ticket_id} failed. Retrying others...`);
                    }
                }
            }
            toast.success("Batch process finished.");
        } catch (err: any) {
            console.error("Batch Claim Error:", err);
            toast.error("Batch claim failed.");
        } finally {
            setClaimAllLoading(false);
        }
    };

    const handleClaim = async (ticketId: number) => {
        if (!contract) return;
        setLoading(true);
        try {
            toast.info(`Claiming ticket #${ticketId}...`);
            const tx = await contract.claim(ticketId);
            const receipt = await tx.wait();

            if (!receipt || receipt.status !== 1) {
                throw new Error("Transaction failed");
            }

            // Sync with backend
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/claim`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                },
                body: JSON.stringify({
                    campaign_address: campaignAddress,
                    ticket_id: ticketId,
                }),
            });

            setWinningTickets(prev => prev.map(t => t.ticket_id === ticketId ? { ...t, claimed: true } : t));
            toast.success("Ticket claimed successfully!");
        } catch (err: any) {
            console.error("Claim error:", err);
            const isRejected = err.code === "ACTION_REJECTED" || err.message?.includes("user denied");
            if (isRejected) {
                toast.error("Transaction rejected by user.");
            } else {
                toast.error("Failed to claim ticket.");
            }
        } finally {
            setLoading(false);
        }
    };

    /* ------------------------------------------------------------
       RENDER
    ------------------------------------------------------------ */
    if (!address) {
        return <div className="text-center text-neutral-500 py-8">Connect wallet to check results.</div>;
    }

    // PENDING RESOLUTION STATE
    if (winningOutcome === null) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-white font-bold">Pending Resolution</h3>
                    <p className="text-xs text-neutral-500 max-w-[200px] mx-auto">
                        Market has ended. Waiting for outcome to be finalized.
                    </p>
                </div>
            </div>
        );
    }

    if (scanLoading) {
        return <div className="flex justify-center p-8"><div className="animate-spin h-6 w-6 border-2 border-accentPurple rounded-full border-t-transparent" /></div>;
    }

    const haswon = winningTickets.length > 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* RESULT HEADER */}
            <div className={`text-center p-6 rounded-xl border ${haswon ? "bg-green-500/10 border-green-500/20" : "bg-neutral-900 border-neutral-800"}`}>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-2 text-neutral-400">Winning Outcome</h3>
                <div className="text-3xl font-black text-white">
                    {winningOutcome !== null ? outcomes[winningOutcome] : "Resolving..."}
                </div>
            </div>

            {/* WINNING TICKETS */}
            {winningTickets.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Your Winning Tickets
                        </h4>

                        {winningTickets.some(t => !t.claimed) && (
                            <button
                                onClick={handleClaimAll}
                                disabled={claimAllLoading || loading}
                                className="text-[10px] font-bold bg-white text-black px-3 py-1 rounded hover:bg-neutral-200 transition-colors disabled:opacity-50"
                            >
                                {claimAllLoading ? `Processing (${claimedCount})` : "Claim All"}
                            </button>
                        )}
                    </div>

                    {winningTickets.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-[#0f0f0f] border border-green-500/30">
                            <div>
                                <div className="text-xs font-mono text-neutral-500">Ticket #{t.ticket_id}</div>
                                <div className="text-white font-bold">{outcomes[t.outcome]}</div>
                            </div>

                            {t.claimed ? (
                                <span className="text-xs font-bold text-green-600 bg-green-900/20 px-3 py-1.5 rounded-full">CLAIMED</span>
                            ) : (
                                <button
                                    onClick={() => handleClaim(t.ticket_id)}
                                    disabled={loading}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold text-xs rounded-lg transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] disabled:opacity-50"
                                >
                                    {loading ? "..." : "Claim Payout"}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* LOSING TICKETS */}
            {losingTickets.length > 0 && (
                <div className="space-y-3 opacity-60">
                    <h4 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Did not Win</h4>
                    {losingTickets.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                            <div>
                                <div className="text-xs font-mono text-neutral-600">Ticket #{t.ticket_id}</div>
                                <div className="text-neutral-400 font-medium">{outcomes[t.outcome]}</div>
                            </div>
                            <span className="text-xs font-bold text-red-500/50">LOST</span>
                        </div>
                    ))}
                </div>
            )}

            {winningTickets.length === 0 && losingTickets.length === 0 && (
                <div className="text-center text-neutral-500 text-xs py-4">
                    You did not participate in this market.
                </div>
            )}

        </div>
    );
}
