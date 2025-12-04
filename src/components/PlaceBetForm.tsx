"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import type { Eip1193Provider } from "ethers";

import { ERC20ABI, BetCampaignABI } from "@/lib/ethers/abi";
import { useToast } from "@/components/toast/ToastContext";
import { CHAIN } from "@/config/network";

const USDC_ADDRESS = CHAIN.addresses.USDC;
const USDC_DECIMALS = 6;
const TARGET_CHAIN_ID = CHAIN.chainId;

type Props = {
  campaignId: number;
  campaignAddress: string;
  bettingClosed: boolean;
};

type PayoutResponse = {
  potential_payout: number;
  potential_profit: number; // Matches backend response
};

// Simple Loading Spinner
const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function PlaceBetForm({ campaignId, campaignAddress, bettingClosed }: Props) {
  const toast = useToast();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [outcome, setOutcome] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [fetchingPayout, setFetchingPayout] = useState(false);
  const [loading, setLoading] = useState(false);

  const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  /* --------------------- Fetch payout preview ----------------------------- */
  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setPayoutData(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setFetchingPayout(true);

        const side = outcome === "Yes"; 
        
        // Use campaign_id parameter instead of campaign_address
        const url = `${process.env.NEXT_PUBLIC_API_URL}/bet/calculate-payout?campaign_id=${campaignId}&side=${side}&stake=${amount}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch payout");

        const json = (await res.json()) as PayoutResponse;

        if (
          typeof json.potential_payout === "number" &&
          typeof json.potential_profit === "number"
        ) {
          setPayoutData(json);
        } else {
          setPayoutData(null);
        }
      } catch {
        setPayoutData(null);
      } finally {
        setFetchingPayout(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [amount, outcome, campaignId]);

  /* --------------------------- Betting Closed ------------------------------ */
  if (bettingClosed) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center bg-neutral-900/50">
        <div className="mx-auto w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h3 className="text-base font-semibold text-white">Market Closed</h3>
        <p className="text-neutral-400 text-sm mt-1">Betting is no longer available for this market.</p>
      </div>
    );
  }

  /* --------------------------- Place Bet ---------------------------------- */
  const handlePlaceBet = async () => {
    if (!accessToken) {
      toast.error("Please log in to place a bet.");
      return;
    }
    if (!isConnected || !walletClient || !address) {
      toast.error("Wallet not connected.");
      return;
    }
    if (chainId !== TARGET_CHAIN_ID) {
      toast.error("Please switch to Base Sepolia.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);

      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner(address);

      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer);
      const campaign = new Contract(campaignAddress, BetCampaignABI, signer);
      const parsedAmount = parseUnits(amount, USDC_DECIMALS);

      // 1. Check Allowance
      toast.info("Checking allowance…");
      const allowance: bigint = await usdc.allowance(address, campaignAddress);
      
      if (allowance < parsedAmount) {
        toast.info("Sending approval…");
        const approveTx = await usdc.approve(campaignAddress, parsedAmount);
        toast.info("Waiting for approval…");
        await approveTx.wait(2);
      }

      // 2. Place Bet
      toast.info("Placing bet…");
      const side = outcome === "Yes" ? 1 : 0;
      const tx = await campaign.join(side, parsedAmount);
      await tx.wait();

      // 3. Extract Ticket ID
      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (!receipt) throw new Error("Could not load receipt.");

      let ticketId: number | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== campaignAddress.toLowerCase()) continue;
        try {
          const parsed = campaign.interface.parseLog(log);
          if (parsed && parsed.name === "Joined") {
            ticketId = Number(parsed.args.ticketId);
            break;
          }
        } catch { continue; }
      }

      if (ticketId === null) throw new Error("Could not extract ticket ID.");

      toast.success("Bet placed successfully!");

      // 4. Save to Backend
      try {
        const token = localStorage.getItem("access_token");
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bet/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            campaign_address: campaignAddress,
            ticket_id: ticketId,
            side,
            stake: amount,
            tx_hash: tx.hash,
          }),
        });
        // Silent success for backend save
      } catch (err) {
        console.error("Backend save error:", err);
      }
      
      setAmount(""); // Reset form
      setPayoutData(null);
      
    } catch (err: unknown) {
      console.error("Bet error:", err);
      
      // Fix: Safely extract error message without using 'any'
      let msg = "Transaction failed";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'string') {
        msg = err;
      }
      
      if (msg.includes("transfer amount exceeds balance")) {
        toast.error("Insufficient USDC balance.");
      } else if (msg.toLowerCase().includes("user rejected") || msg.includes("4001")) {
        toast.error("Transaction cancelled.");
      } else {
        toast.error(msg.slice(0, 60));
      }
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------- UI --------------------------------------- */
  return (
    <div className="flex flex-col gap-5">
      
      {/* 1. OUTCOME SELECTOR */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">
          Choose Outcome
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOutcome("Yes")}
            className={`
              relative overflow-hidden rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-200
              flex items-center justify-center gap-2
              ${
                outcome === "Yes"
                  ? "border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800"
              }
            `}
          >
            {outcome === "Yes" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            YES
          </button>
          
          <button
            onClick={() => setOutcome("No")}
            className={`
              relative overflow-hidden rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-200
              flex items-center justify-center gap-2
              ${
                outcome === "No"
                  ? "border-red-500 bg-red-500/10 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800"
              }
            `}
          >
            {outcome === "No" && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
            NO
          </button>
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
            <span className="text-sm font-bold text-neutral-500">USDC</span>
          </div>
        </div>
      </div>

      {/* 3. PAYOUT PREVIEW */}
      <div className="rounded-xl bg-neutral-900/50 border border-neutral-800 p-4 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-400">Potential Payout</span>
          {fetchingPayout ? (
            <div className="h-4 w-16 bg-neutral-800 animate-pulse rounded" />
          ) : (
            <span className="text-white font-mono font-medium">
              ${payoutData?.potential_payout.toFixed(2) ?? "0.00"}
            </span>
          )}
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-neutral-400">Net Profit</span>
           {fetchingPayout ? (
            <div className="h-4 w-12 bg-neutral-800 animate-pulse rounded" />
          ) : (
            <span className={`${(payoutData?.potential_profit || 0) > 0 ? "text-green-400" : "text-neutral-500"} font-mono font-medium`}>
              +{(payoutData?.potential_profit || 0).toFixed(2)} USDC
            </span>
          )}
        </div>
      </div>

      {/* 4. SUBMIT BUTTON */}
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
          "Confirm Bet"
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