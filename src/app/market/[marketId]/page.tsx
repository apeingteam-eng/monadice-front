"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Contract, JsonRpcProvider } from "ethers";
import MarketSkeleton from "./MarketSkeleton"
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network";
import PlaceBetForm from "@/components/PlaceBetForm";
import { useToast } from "@/components/toast/ToastContext";
import ClaimView from "@/components/market/ClaimView";
import TicketGallery from "@/components/market/TicketGallery";
/* -------------------------------------------------------------------------- */
/*                              Types / Helpers                               */
/* -------------------------------------------------------------------------- */

type Campaign = {
  id: number;
  name: string;
  symbol: string;
  creator_wallet: string;
  campaign_address: string;
  end_time: number;
  state: string;
  fee_bps: number;
  creation_stake: number;
  tx_hash: string;
  deployed_at: string;

  // Backend-calculated stats (NEW)
  totalTrue: number;
  totalFalse: number;
  totalInitialPot: number;
  volume: number;

  yes_odds: number;
  no_odds: number;

  percent_true: number;
  percent_false: number;

  resolved: boolean;
};

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(endUnix - now, 0);

  const hours = Math.floor(diff / 3600);
  const days = Math.floor(hours / 24);

  if (diff <= 0) return "Expired";
  if (days > 0) return `Expires in ~${days}d ${hours % 24}h`;
  return `Expires in ~${hours}h`;
}

function formatUsdShort(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export default function MarketPage() {
  const { marketId } = useParams();
  const toast = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const [trueAmt, setTrueAmt] = useState(0);
  const [falseAmt, setFalseAmt] = useState(0);
  const [potAmt, setPotAmt] = useState(0);
  const [yesPercent, setYesPercent] = useState(50);
  const [noPercent, setNoPercent] = useState(50);
  const [oddsYes, setOddsYes] = useState("1.00");
  const [oddsNo, setOddsNo] = useState("1.00");
  const [volume, setVolume] = useState(0);

  /* -------------------------------------------------------------------------- */
  /*                1. Load campaign from backend (/factory/campaign)           */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    async function loadCampaign() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/factory/campaign/${marketId}`
        );

        if (!res.ok) {
          toast.error("Unable to load market from backend.");
          return;
        }

        const data = await res.json();
        setCampaign(data);
      } catch (err) {
        console.error("Failed to fetch campaign:", err);
        toast.error("Failed to connect to backend.");
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  }, [marketId, toast]);


  /* Use backend-calculated values directly */
useEffect(() => {
  if (!campaign) return;

  // backend returns these already calculated:
  // percent_true, percent_false, totalTrue, totalFalse, totalInitialPot,
  // volume, yes_odds, no_odds

  setYesPercent(campaign.percent_true);
  setNoPercent(campaign.percent_false);

  setTrueAmt(campaign.totalTrue);
  setFalseAmt(campaign.totalFalse);
  setPotAmt(campaign.totalInitialPot);

  setVolume(campaign.volume);

  setOddsYes(campaign.yes_odds.toFixed(2));
  setOddsNo(campaign.no_odds.toFixed(2));
}, [campaign]);
  /* -------------------------------------------------------------------------- */
  /*                                  Rendering                                 */
  /* -------------------------------------------------------------------------- */

 if (loading) return <MarketSkeleton />;

  if (!campaign) {
    toast.error("Market not found.");
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-xl font-semibold">Market not found</h1>
      </div>
    );
  }

  /* ------------------------- Market state display --------------------------- */

  const isRunning = campaign.state === "open" && campaign.resolved === false;
  const isPending = campaign.state === "open" && campaign.resolved === true;
  const isEnded = campaign.state === "resolved";
  const bettingClosed = isPending || isEnded;

  let statusLabel = "Ended";
  let pillColor = "bg-red-500/15 text-red-400";
  let dotColor = "bg-red-400";

  if (isRunning) {
    statusLabel = "Running";
    pillColor = "bg-green-500/15 text-green-400";
    dotColor = "bg-green-400";
  } else if (isPending) {
    statusLabel = "Pending";
    pillColor = "bg-yellow-400/15 text-yellow-400";
    dotColor = "bg-yellow-400";
  }

  const countdown = formatCountdown(campaign.end_time);

  /* -------------------------------------------------------------------------- */
  /*                                   JSX                                      */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="container mx-auto p-0 md:p-6">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div
          className="h-40 md:h-56 w-full grid place-items-center"
          style={{
            background: "linear-gradient(135deg, #9b5de5 0%, #7a4edb 100%)",
          }}
        >
          <span className="text-white/90 text-sm"></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        {/* LEFT PANEL */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {campaign.symbol !== "N/A" && (
              <span className="inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-3 py-1 text-xs font-medium">
                {campaign.symbol}
              </span>
            )}

            <span className="text-xs text-neutral-500">{countdown}</span>

            <span
  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${pillColor}`}
>
  <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${dotColor}`} />
  {statusLabel}
</span>
          </div>

          <h1 className="text-2xl font-semibold">{campaign.name}</h1>

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Market created by{" "}
            <span className="font-mono text-accentPurple">
              {campaign.creator_wallet.slice(0, 6)}…
              {campaign.creator_wallet.slice(-4)}
            </span>
            . Bet and earn based on your prediction accuracy.
          </p>

          {/* Outcomes */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Outcomes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-md border px-3 py-2 bg-neutral-900 text-sm flex justify-between">
                <span>Yes</span>
                <span className="font-semibold">{yesPercent}%</span>
              </div>
              <div className="rounded-md border px-3 py-2 bg-neutral-900 text-sm flex justify-between">
                <span>No</span>
                <span className="font-semibold">{noPercent}%</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">Volume</div>
              <div className="font-semibold">{formatUsdShort(volume)}</div>
            </div>

            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">Yes Odds</div>
              <div className="font-semibold">{oddsYes}x</div>
            </div>

            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">No Odds</div>
              <div className="font-semibold">{oddsNo}x</div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Bet or Claim */}
<div className="md:col-span-1">
 {isRunning ? (
  <PlaceBetForm
    campaignAddress={campaign.campaign_address}
    bettingClosed={false}
  />
) : (
 <ClaimView
  campaignAddress={campaign.campaign_address as `0x${string}`}
  endTime={campaign.end_time}
  
/>
)}

</div>

      </div>
    <div className="p-6">
  <TicketGallery
    campaignAddress={campaign.campaign_address as `0x${string}`}
    endTime={campaign.end_time}
    state={
      campaign.state === "open" ? 0 :
      campaign.state === "resolved" ? 1 :
      campaign.state === "cancelled" ? 2 :
      0
    }
  />
</div>
    </div>
  );
}