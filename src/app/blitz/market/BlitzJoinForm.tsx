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
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const chainId = useChainId();
    const toast = useToast();

    // State
    const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number>(0);
    const [amount, setAmount] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Derived
    const isNative = betToken === ZERO_ADDRESS;
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    /* ------------------------------------------------------------
       HANDLERS
    ------------------------------------------------------------ */
    const handlePlaceBet = async () => {
        if (!isConnected || !address || !walletClient) {
            toast.error("Please connect your wallet first.");
            return;
        }

        if (chainId !== TARGET_CHAIN_ID) {
            toast.error(`Wrong network. Please switch to Monad Testnet.`);
            return;
        }

        if (!amount || Number(amount) <= 0) {
            toast.error("Please enter a valid amount.");
            return;
        }

        // Check whitelist if permissioned
        /* 
        // Logic for whitelist check if needed, but handled by contract revert usually
        if (permissioned) { ... }
        */

        setLoading(true);

        try {
            const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
            const signer = await provider.getSigner(address);
            const campaignContract = new Contract(campaignAddress, BlitzBetCampaignABI, signer);

            const parsedAmount = parseUnits(amount, 18); // Assume 18 decimals for now

            // 1. APPROVAL (Only if NOT Native)
            if (!isNative) {
                const tokenContract = new Contract(betToken, ERC20ABI, signer);
                // Check allowance
                const allowance = await tokenContract.allowance(address, campaignAddress);
                if (allowance < parsedAmount) {
                    toast.info("Approving token...");
                    const txApprove = await tokenContract.approve(campaignAddress, parsedAmount);
                    await txApprove.wait();
                    toast.success("Approved!");
                }
            }

            // 2. JOIN
            toast.info("Placing bet...");

            // If native, send value. If ERC20, value is 0.
            const txOverrides = isNative ? { value: parsedAmount } : {};

            // Contract function: join(outcome, amount)
            const tx = await campaignContract.join(
                selectedOutcomeIndex,
                parsedAmount,
                txOverrides
            );

            const receipt = await tx.wait();

            if (!receipt || receipt.status !== 1) {
                throw new Error("Transaction failed on-chain.");
            }

            await handleSuccess(tx.hash, provider, campaignContract);

        } catch (err: any) {
            console.error("Bet Error:", err);
            const isRejected = err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001 || err.message?.includes("user denied");
            if (isRejected) {
                toast.error("Transaction cancelled.");
            } else {
                toast.error(err.reason || err.message || "Failed to place bet.");
            }
        } finally {
            setLoading(false);
        }
    };

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
