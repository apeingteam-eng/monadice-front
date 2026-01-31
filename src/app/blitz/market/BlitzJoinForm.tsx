"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits, parseEther } from "ethers";
import type { Eip1193Provider } from "ethers";

import BlitzBetCampaignABI from "@/lib/ethers/abi/BlitzBetCampaign.json";
import { ERC20ABI } from "@/lib/ethers/abi"; // Assuming standard ERC20 ABI is here or we use a basic interface
import { useToast } from "@/components/toast/ToastContext";
import { CHAIN } from "@/config/network";

const TARGET_CHAIN_ID = CHAIN.chainId;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type Props = {
    campaignAddress: string;
    betToken: string;
    outcomes: string[];
    bettingClosed: boolean;
    permissioned?: boolean;
    onJoinSuccess?: () => void;
};

// ... (Spinner code)

export default function BlitzJoinForm({ campaignAddress, betToken, outcomes, bettingClosed, permissioned = false, onJoinSuccess }: Props) {
    // ... (rest of component hooks)

    // ... (handlePlaceBet)

    const handleSuccess = async (txHash: string, provider: any, campaignContract: any) => {
        // ... (existing log parsing logic)
        const receipt = await provider.getTransactionReceipt(txHash);
        let ticketId: number | null = null;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== campaignAddress.toLowerCase()) continue;
            try {
                const parsed = campaignContract.interface.parseLog(log);
                if (parsed && parsed.name === "Joined") {
                    ticketId = Number(parsed.args.ticketId);
                    break;
                }
            } catch { }
        }

        if (ticketId === null) {
            toast.error("Bet placed but failed to get Ticket ID.");
            return;
        }

        toast.success("Bet placed successfully!");

        // API Call
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/join`, {
                // ... (rest of fetch args)
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    campaign_address: campaignAddress,
                    ticket_id: ticketId,
                    outcomes: selectedOutcomeIndex,
                    amounts: Number(amount)
                })
            });

            if (!res.ok) console.error("Backend join sync failed");
        } catch (e) {
            console.error("Backend join sync error", e);
        }

        setAmount("");
        if (onJoinSuccess) onJoinSuccess();
    };

    // ... (rest of UI)
    return (
        <div className="flex flex-col gap-5">
            {/* ... (rest of render) */}
            {/* 1. OUTCOME SELECTOR */}
            <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">
                    Choose Outcome
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {outcomes.map((label, idx) => {
                        const isSelected = selectedOutcomeIndex === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedOutcomeIndex(idx)}
                                className={`
                  relative overflow-hidden rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-200
                  flex items-center justify-center gap-2
                  ${isSelected
                                        ? "border-accentPurple bg-accentPurple/10 text-accentPurple shadow-[0_0_15px_rgba(155,93,229,0.2)]"
                                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800"
                                    }
                `}
                            >
                                {isSelected && <span className="w-2 h-2 rounded-full bg-accentPurple animate-pulse" />}
                                <span className="truncate">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. AMOUNT INPUT */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Wager Amount
                    </label>
                </div>

                <div className="relative group">
                    <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        placeholder="0.00"
                        className="
              w-full rounded-xl border border-neutral-800 bg-black/40 
              px-4 py-3.5 pr-16 
              text-lg font-medium text-white 
              placeholder:text-neutral-600
              focus:border-accentPurple focus:ring-1 focus:ring-accentPurple/50 
              outline-none transition-all
            "
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        <span className="text-sm font-bold text-neutral-500">{isNative ? "MON" : "TOKEN"}</span>
                    </div>
                </div>
            </div>

            {/* 3. SUBMIT BUTTON */}
            <button
                onClick={handlePlaceBet}
                disabled={loading || !amount || Number(amount) <= 0}
                className={`
          w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-all duration-200
          flex items-center justify-center gap-2
          ${loading
                        ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                        : "bg-accentPurple hover:bg-accentPurple/90 text-white shadow-lg hover:shadow-accentPurple/25 hover:-translate-y-0.5"
                    }
        `}
            >
                {loading ? (
                    <>
                        <Spinner /> Processing...
                    </>
                ) : (
                    "Place Bet"
                )}
            </button>

            <div className="text-center">
                <p className="text-[10px] text-neutral-600">
                    Interacting with contract <span className="font-mono text-neutral-500">{campaignAddress.slice(0, 6)}...{campaignAddress.slice(-4)}</span>
                </p>
            </div>
        </div>
    );
}
