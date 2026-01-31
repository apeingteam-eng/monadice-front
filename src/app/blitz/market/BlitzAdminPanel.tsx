"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import type { Eip1193Provider } from "ethers";

import BlitzBetCampaignABI from "@/lib/ethers/abi/BlitzBetCampaign.json";
import { useToast } from "@/components/toast/ToastContext";
import { CHAIN } from "@/config/network";

type Props = {
    campaignAddress: string;
    outcomes: string[];
    permissioned: boolean;
};

// Spinner
const Spinner = () => (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default function BlitzAdminPanel({ campaignAddress, outcomes, permissioned }: Props) {
    const toast = useToast();
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const chainId = useChainId();
    const TARGET_CHAIN_ID = CHAIN.chainId;

    // Resolve State
    const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number>(0);
    const [resolving, setResolving] = useState(false);

    // Whitelist State
    const [whitelistInput, setWhitelistInput] = useState("");
    const [queuedAddresses, setQueuedAddresses] = useState<string[]>([]);
    const [whitelisting, setWhitelisting] = useState(false);

    /* -------------------------------------------------------------------------- */
    /* RESOLVE MARKET
    /* -------------------------------------------------------------------------- */
    const handleResolve = async () => {
        if (!walletClient || !address) return toast.error("Wallet not connected");
        if (chainId !== TARGET_CHAIN_ID) return toast.error("Wrong network");

        try {
            setResolving(true);
            const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
            const signer = await provider.getSigner(address);
            const contract = new Contract(campaignAddress, BlitzBetCampaignABI, signer);

            toast.info(" resolving market...");
            const tx = await contract.resolve(selectedOutcomeIndex);
            await tx.wait();

            toast.success("Market resolved on-chain!");

            // Sync with Backend
            try {
                const token = localStorage.getItem("access_token");
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/resolve`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        campaign_address: campaignAddress,
                        winning_outcome: selectedOutcomeIndex
                    })
                });
                toast.success("Backend synced!");
            } catch (err) {
                console.error("Backend sync failed", err);
                toast.warning("Backend sync failed. Please contact support.");
            }

            // Ideally trigger a refresh of the page or status
        } catch (e: any) {
            console.error(e);
            toast.error(e.reason || e.message || "Failed to resolve");
        } finally {
            setResolving(false);
        }
    };

    /* -------------------------------------------------------------------------- */
    /* WHITELIST LOGIC
    /* -------------------------------------------------------------------------- */
    const handleQueueAddress = () => {
        const addr = whitelistInput.trim();
        if (!addr) return;
        if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return toast.error("Invalid address");
        if (queuedAddresses.includes(addr)) {
            setWhitelistInput("");
            return;
        }
        setQueuedAddresses([...queuedAddresses, addr]);
        setWhitelistInput("");
    };

    const submitWhitelist = async () => {
        if (!walletClient || !address) return toast.error("Wallet not connected");
        if (chainId !== TARGET_CHAIN_ID) return toast.error("Wrong network");
        if (queuedAddresses.length === 0) return toast.error("Queue is empty");

        try {
            setWhitelisting(true);
            const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
            const signer = await provider.getSigner(address);
            const contract = new Contract(campaignAddress, BlitzBetCampaignABI, signer);

            // 1. Contract Call
            toast.info(`Whitelisting ${queuedAddresses.length} addresses...`);
            const tx = await contract.addToWhitelist(queuedAddresses);
            await tx.wait();
            toast.success("Addresses whitelisted on-chain!");

            // 2. API Call (Sync)
            try {
                const token = localStorage.getItem("access_token");
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/whitelist/add`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        campaign_address: campaignAddress,
                        users: queuedAddresses
                    })
                });
                toast.success("Backend synced!");
            } catch (err) {
                console.error("API sync failed", err);
                toast.error("API sync failed (but chain succeeded)");
            }

            setQueuedAddresses([]);
        } catch (e: any) {
            console.error(e);
            toast.error(e.reason || e.message || "Failed to whitelist");
        } finally {
            setWhitelisting(false);
        }
    };


    return (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-yellow-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wide">Creator Admin Panel</h3>
            </div>

            <div className="space-y-6">

                {/* RESOLVE SECTION */}
                <div>
                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase">Resolve Market</label>
                    <div className="flex gap-2">
                        <select
                            className="flex-1 bg-neutral-900 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-yellow-500"
                            value={selectedOutcomeIndex}
                            onChange={(e) => setSelectedOutcomeIndex(Number(e.target.value))}
                        >
                            {outcomes.map((o, i) => (
                                <option key={i} value={i}>{o}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleResolve}
                            disabled={resolving}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {resolving && <Spinner />}
                            Resolve
                        </button>
                    </div>
                </div>

                {/* WHITELIST SECTION */}
                {permissioned && (
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase">Add to Whitelist</label>

                        {/* Input Row */}
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                className="flex-1 bg-neutral-900 border border-neutral-700 text-white text-xs font-mono rounded-lg px-3 py-2 outline-none focus:border-yellow-500"
                                placeholder="0x..."
                                value={whitelistInput}
                                onChange={(e) => setWhitelistInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleQueueAddress()}
                            />
                            <button
                                onClick={handleQueueAddress}
                                disabled={!whitelistInput}
                                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg border border-neutral-700 transition-colors"
                            >
                                Add
                            </button>
                        </div>

                        {/* Queue List */}
                        {queuedAddresses.length > 0 && (
                            <div className="bg-black/20 rounded-lg p-2 mb-3 space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar border border-neutral-800/50">
                                {queuedAddresses.map((addr, i) => (
                                    <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-neutral-900/50 rounded hover:bg-neutral-900 transition-colors group">
                                        <span className="text-[10px] font-mono text-neutral-400">{addr}</span>
                                        <button
                                            onClick={() => setQueuedAddresses(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end items-center gap-3">
                            <span className="text-[10px] text-neutral-500">{queuedAddresses.length} ready to add</span>
                            <button
                                onClick={submitWhitelist}
                                disabled={whitelisting || queuedAddresses.length === 0}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-600/20"
                            >
                                {whitelisting && <Spinner />}
                                Submit to Contract
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
