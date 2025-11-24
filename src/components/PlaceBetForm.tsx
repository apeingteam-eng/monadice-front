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
  campaignAddress: string;
  bettingClosed: boolean;
};

type PayoutResponse = {
  potential_payout: number;
  estimated_profit: number;
};

function CustomDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          w-full px-3 py-2 rounded-md
          bg-neutral-900/60 border border-neutral-700/50
          text-neutral-200 text-left
          focus:border-accentPurple focus:ring-1 focus:ring-accentPurple
          outline-none transition
          flex justify-between items-center
        "
      >
        {value}
        <span className="text-neutral-500">▼</span>
      </button>

      {open && (
        <div
          className="
            absolute left-0 right-0 mt-2
            bg-neutral-900/90 backdrop-blur-xl
            border border-neutral-700/50
            rounded-lg shadow-xl z-20
          "
        >
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="
                px-3 py-2 cursor-pointer
                text-neutral-200
                hover:bg-accentPurple/20 transition
              "
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaceBetForm({ campaignAddress, bettingClosed }: Props) {
  const toast = useToast();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [outcome, setOutcome] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [fetchingPayout, setFetchingPayout] = useState(false);
  const [loading, setLoading] = useState(false);
const accessToken =
  typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
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

        const url = `${process.env.NEXT_PUBLIC_API_URL}/bet/potential-payout?campaign_address=${campaignAddress}&side=${side}&amount=${amount}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch payout");

        const json = (await res.json()) as PayoutResponse;

        if (
          typeof json.potential_payout === "number" &&
          typeof json.estimated_profit === "number"
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
  }, [amount, outcome, campaignAddress]);

  /* --------------------------- Betting Closed ------------------------------ */
  if (bettingClosed) {
    return (
      <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 text-center">
        <h3 className="text-base font-semibold mb-2">Place Bet</h3>
        <p className="text-neutral-400 text-sm">This market is closed for betting.</p>
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

      toast.info("Checking allowance…");

      const allowance: bigint = await usdc.allowance(address, campaignAddress);
      if (allowance < parsedAmount) {
        toast.info("Sending approval…");

        const approveTx = await usdc.approve(campaignAddress, parsedAmount);

        toast.info("Waiting for approval confirmations…");

        await approveTx.wait(2);

        // Double check allowance
        let updatedAllowance = await usdc.allowance(address, campaignAddress);
        while (updatedAllowance < parsedAmount) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          updatedAllowance = await usdc.allowance(address, campaignAddress);
        }

        toast.success("USDC approved!");
      }

      toast.info("Placing bet…");

      const side = outcome === "Yes" ? 1 : 0;
      const tx = await campaign.join(side, parsedAmount);
      await tx.wait();

/* ---------------------- Extract TICKET ID ---------------------- */
const receipt = await provider.getTransactionReceipt(tx.hash);
if (!receipt) {
  toast.error("Could not load transaction receipt.");
  setLoading(false);
  return;
}

let ticketId: number | null = null;

for (const log of receipt.logs) {
  // Only parse events emitted by this BetCampaign contract
  if (log.address.toLowerCase() !== campaignAddress.toLowerCase()) continue;

  let parsed;
  try {
    parsed = campaign.interface.parseLog(log);
  } catch {
    continue; // skip logs that do not match this ABI
  }

  // TS-SAFE: check parsed is not null
  if (parsed && parsed.name === "Joined") {
    ticketId = Number(parsed.args.ticketId);
    break;
  }
}

if (ticketId === null) {
  toast.error("Could not extract ticket ID from logs.");
  setLoading(false);
  return;
}
      toast.success("Bet placed!");

      /* ---------------------- SAVE BET TO BACKEND ---------------------- */
      try {
     const token = localStorage.getItem("access_token");

const saveRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bet/save`, {
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

        if (!saveRes.ok) throw new Error("Save failed");

        toast.success("Bet saved!");
      } catch (err) {
        console.error("Save bet error:", err);
        toast.error("Bet placed but failed saving to backend.");
      }
    } catch (err: unknown) {
      console.error("Bet error:", err);

      const msg =
        err instanceof Error ? err.message : String(err ?? "Transaction failed");

      if (msg.includes("transfer amount exceeds balance")) {
        toast.error("Not enough USDC.");
        return;
      }

      if (msg.includes("4001") || msg.toLowerCase().includes("cancel")) {
        toast.error("Transaction cancelled.");
        return;
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------- UI --------------------------------------- */
  return (
    <div className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 space-y-4">
      <h3 className="text-base font-semibold">Place Bet</h3>

      <label className="text-sm">Outcome</label>
      <CustomDropdown
        value={outcome}
        onChange={(v) => setOutcome(v as "Yes" | "No")}
        options={["Yes", "No"]}
      />

      <label className="text-sm">Amount (USDC)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-sm"
      />

      {/* ----------- Payout Section ----------- */}
      {fetchingPayout ? (
        <p className="text-xs text-neutral-500">Calculating payout…</p>
      ) : payoutData ? (
        <div className="text-sm text-neutral-300 space-y-1">
          <div>
            <span className="font-medium text-accentPurple">Potential Payout: </span>
            ${payoutData.potential_payout.toFixed(3)}
          </div>
          <div>
            <span className="font-medium text-neutral-400">Estimated Profit: </span>
            {payoutData.estimated_profit >= 0 ? "+" : ""}
            {payoutData.estimated_profit.toFixed(3)} USDC
          </div>
        </div>
      ) : null}

      <button
        onClick={handlePlaceBet}
        disabled={loading}
        className="w-full rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Processing…" : "Place Bet"}
      </button>

      <p className="text-xs text-neutral-500">
        Market: {campaignAddress.slice(0, 6)}…{campaignAddress.slice(-4)}
      </p>
    </div>
  );
}