"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type MarketSummary = {
  id: number;
  name: string;
  symbol: string;
  end_time: number;
  state: string;
  fee_bps: number;
  campaign_address: string;
};

/* Backend stats shape */
type CampaignStats = {
  totalTrue: number;
  totalFalse: number;
  totalInitialPot: number;
  volume: number;
  yes_odds: number;
  no_odds: number;
  percent_true: number;
  percent_false: number;
};

/* Format $ numbers */
function formatUsdShort(n: number) {
  if (!n || isNaN(n)) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(endUnix - now, 0);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (diff <= 0) return "Ended";
  if (hours === 0) return `Ends in ${minutes}m`;
  return `Ends in ${hours}h ${minutes}m`;
}

type Props = {
  market: MarketSummary;
};

export default function MarketCard({ market }: Props) {
  const [stats, setStats] = useState<CampaignStats>({
    totalTrue: 0,
    totalFalse: 0,
    totalInitialPot: 0,
    volume: 0,
    yes_odds: 1,
    no_odds: 1,
    percent_true: 50,
    percent_false: 50,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/factory/campaign/${market.id}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error("Failed to load campaign stats", e);
      }
    }
    loadStats();
  }, [market.id]);

  // ---- Status label ----
  const now = Math.floor(Date.now() / 1000);
  const isEnded = market.end_time <= now;
  const isOpen = market.state === "open";

  let statusLabel = "Ended";
  let statusColor = "text-red-400";
  let dotColor = "bg-red-500";

  if (isOpen && !isEnded) {
    statusLabel = "Running";
    statusColor = "text-green-400";
    dotColor = "bg-green-500";
  } else if (isOpen && isEnded) {
    statusLabel = "Pending";
    statusColor = "text-yellow-400";
    dotColor = "bg-yellow-400";
  }

  return (
    <Link
      href={`/market/${market.id}`}
      className="group rounded-lg border border-neutral-800/80 bg-neutral-900 p-4 hover:shadow-md hover:border-accentPurple/40 transition-colors relative"
    >
      {/* Status */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${dotColor}`} />
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Volume */}
      <div className="mb-3 text-sm text-neutral-500">
        {formatUsdShort(stats.volume)} Vol.
      </div>

      {/* Symbol */}
      {market.symbol && (
        <div className="mb-2 inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-2.5 py-0.5 text-xs font-medium">
          {market.symbol}
        </div>
      )}

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold group-hover:text-accentPurple">
        {market.name}
      </h3>

      {/* Countdown */}
      <p className="text-xs text-neutral-500 mb-3">
        {formatCountdown(market.end_time)}
      </p>

      {/* YES / NO */}
      <div className="grid grid-cols-2 gap-2">

        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-neutral-950 border-neutral-700">
          <span className="white-300">Yes</span>
          <span className="font-medium white-300">{stats.percent_true}%</span>
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-neutral-950 border-neutral-700">
          <span className="white-300">No</span>
          <span className="font-medium white-300">{stats.percent_false}%</span>
        </div>

      </div>
    </Link>
  );
}