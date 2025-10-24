"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PlaceBetForm from "@/components/PlaceBetForm";

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
};

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(endUnix - now, 0);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (diff <= 0) return "Expired";
  if (days > 0) return `Expires in ~${days}d ${hours}h`;
  return `Expires in ~${hours}h`;
}

export default function MarketPage() {
  const { marketId } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCampaign() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/factory/campaign/${marketId}`
        );
        const data = await res.json();
        setCampaign(data);
      } catch (err) {
        console.error("Failed to fetch campaign:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCampaign();
  }, [marketId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-neutral-400">
        Loading market…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-xl font-semibold">Market not found</h1>
      </div>
    );
  }

  // ====== STATUS LOGIC ======
  const now = Math.floor(Date.now() / 1000);
  const isEnded = campaign.end_time <= now;
  const isOpen = campaign.state === "open";

  let statusLabel = "Ended";
  let statusColor = "text-red-400";
  let pillColor = "bg-red-500/15 text-red-400";
  let dotColor = "bg-red-400";

  if (isOpen && !isEnded) {
    statusLabel = "Running";
    statusColor = "text-green-400";
    pillColor = "bg-green-500/15 text-green-400";
    dotColor = "bg-green-400";
  } else if (isOpen && isEnded) {
    statusLabel = "Pending";
    statusColor = "text-yellow-400";
    pillColor = "bg-yellow-400/15 text-yellow-400";
    dotColor = "bg-yellow-400";
  }

  const countdown = formatCountdown(campaign.end_time);

  return (
    <div className="container mx-auto p-0 md:p-6">
      {/* Gradient header */}
      <div className="relative overflow-hidden">
        <div
          className="h-40 md:h-56 w-full grid place-items-center"
          style={{
            background: "linear-gradient(135deg, #9b5de5 0%, #7a4edb 100%)",
          }}
        >
          <span className="text-white/90 text-sm">Market</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        {/* Left: details */}
        <div className="md:col-span-2 space-y-4">
          {/* Category + Status */}
          <div className="flex flex-wrap items-center gap-3">
            {campaign.symbol && campaign.symbol !== "N/A" && (
              <span className="inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-3 py-1 text-xs font-medium">
                {campaign.symbol}
              </span>
            )}

            <span className="text-xs text-neutral-500">{countdown}</span>

            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${pillColor}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
              {statusLabel}
            </span>
          </div>

          {/* Name */}
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>

          {/* Description */}
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This is a prediction market created by{" "}
            <span className="font-mono text-accentPurple">
              {campaign.creator_wallet.slice(0, 6)}…
              {campaign.creator_wallet.slice(-4)}
            </span>
            . Bet on the outcome and earn based on your prediction accuracy.
          </p>

          {/* Outcomes (dummy for now) */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Outcomes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
              {[
                { label: "Yes", percent: 91 },
                { label: "No", percent: 9 },
              ].map((o) => (
                <button
                  key={o.label}
                  className="rounded-md border border-accentPurple/30 px-3 py-2 text-sm flex items-center justify-between bg-accentPurple/15 text-accentPurple hover:bg-accentPurple hover:text-white transition-colors"
                >
                  <span>{o.label}</span>
                  <span className="font-semibold">{o.percent}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">Volume</div>
              <div className="font-semibold">$190.0m</div>
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">Total bets</div>
              <div className="font-semibold">520,341</div>
            </div>
          </div>
        </div>

        {/* Right: place bet */}
        <div className="md:col-span-1">
          <PlaceBetForm campaignAddress={campaign.campaign_address} />
        </div>
      </div>
    </div>
  );
}
