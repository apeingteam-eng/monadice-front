"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseEther } from "ethers";
import type { Eip1193Provider } from "ethers";

import BlitzBetCampaignABI from "@/lib/ethers/abi/BlitzBetCampaign.json";
import { useToast } from "@/components/toast/ToastContext";
import { CHAIN } from "@/config/network";

/* ------------------------------------------------------------
   CONSTANTS
------------------------------------------------------------ */
const TARGET_CHAIN_ID = CHAIN.chainId;

/* ------------------------------------------------------------
   TYPES
------------------------------------------------------------ */
type Props = {
  campaignAddress: string;
  outcomes: string[];
  bettingClosed: boolean;
};

/* ------------------------------------------------------------
   LOADING SPINNER
------------------------------------------------------------ */
const Spinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

/* ------------------------------------------------------------
   COMPONENT
------------------------------------------------------------ */
export default function BlitzJoinForm({
  campaignAddress,
  outcomes,
  bettingClosed,
}: Props) {
  const toast = useToast();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const accessToken =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  /* ------------------------------------------------------------
     BETTING CLOSED
  ------------------------------------------------------------ */
  if (bettingClosed) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center bg-neutral-900/50">
        <h3 className="text-base font-semibold text-white">
          Market Closed
        </h3>
        <p className="text-neutral-400 text-sm mt-1">
          Betting is no longer available.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------
     JOIN MARKET
  ------------------------------------------------------------ */
  const handleJoin = async () => {
    if (!accessToken) {
      toast.error("Please log in to join.");
      return;
    }
    if (!isConnected || !walletClient || !address) {
      toast.error("Wallet not connected.");
      return;
    }
    if (chainId !== TARGET_CHAIN_ID) {
      toast.error(`Switch to ${CHAIN.name}.`);
      return;
    }
    if (selectedOutcome === null) {
      toast.error("Select an outcome.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    try {
      setLoading(true);

      const provider = new BrowserProvider(
        walletClient.transport as Eip1193Provider
      );
      const signer = await provider.getSigner(address);

      const campaign = new Contract(
        campaignAddress,
        BlitzBetCampaignABI,
        signer
      );

      const value = parseEther(amount);

      toast.info("Joining Blitz market…");

      const tx = await campaign.join(
        selectedOutcome,
        { value }
      );

      const receipt = await tx.wait();

      /* ------------------ EXTRACT TICKET ID ------------------ */
      let ticketId: number | null = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== campaignAddress.toLowerCase())
          continue;
        try {
          const parsed = campaign.interface.parseLog(log);
          if (parsed?.name === "Joined") {
            ticketId = Number(parsed.args.ticketId);
            break;
          }
        } catch {}
      }

      toast.success("Joined successfully!");

      /* ------------------ SAVE TO BACKEND ------------------ */
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/blitz/save-join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              campaign_address: campaignAddress,
              ticket_id: ticketId,
              outcome_index: selectedOutcome,
              stake: amount,
              tx_hash: tx.hash,
            }),
          }
        );
      } catch (err) {
        console.error("Backend save failed:", err);
      }

      setAmount("");
      setSelectedOutcome(null);
    } catch (err: unknown) {
      console.error("Join error:", err);

      let msg = "Transaction failed";
      if (err instanceof Error) msg = err.message;

      if (msg.toLowerCase().includes("user rejected")) {
        toast.error("Transaction cancelled.");
      } else if (msg.toLowerCase().includes("insufficient")) {
        toast.error("Insufficient balance.");
      } else {
        toast.error(msg.slice(0, 80));
      }
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------
     UI
  ------------------------------------------------------------ */
  return (
    <div className="flex flex-col gap-5">

      {/* OUTCOME SELECT */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">
          Choose Outcome
        </label>

        <div className="grid grid-cols-1 gap-3">
          {outcomes.map((o, i) => (
            <button
              key={i}
              onClick={() => setSelectedOutcome(i)}
              className={`
                rounded-xl border px-4 py-3 text-sm font-semibold transition
                ${
                  selectedOutcome === i
                    ? "border-accentPurple bg-accentPurple/10 text-accentPurple shadow"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700"
                }
              `}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* AMOUNT */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase mb-2 block">
          Stake Amount (MON)
        </label>

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          placeholder="0.00"
          className="
            w-full rounded-xl border border-neutral-800 bg-black/40
            px-4 py-3 text-lg text-white
            placeholder:text-neutral-600
            focus:border-accentPurple focus:ring-1 focus:ring-accentPurple/50
            outline-none
          "
        />
      </div>

      {/* SUBMIT */}
      <button
        onClick={handleJoin}
        disabled={loading || !amount || selectedOutcome === null}
        className={`
          w-full rounded-xl py-3.5 font-bold transition
          flex items-center justify-center gap-2
          ${
            loading
              ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
              : "bg-accentPurple hover:bg-accentPurple/90 text-white shadow-lg"
          }
        `}
      >
        {loading ? (
          <>
            <Spinner /> Joining…
          </>
        ) : (
          "Join Market (Mint Ticket)"
        )}
      </button>

      <p className="text-[10px] text-center text-neutral-600">
        Contract{" "}
        <span className="font-mono">
          {campaignAddress.slice(0, 6)}…{campaignAddress.slice(-4)}
        </span>
      </p>
    </div>
  );
}