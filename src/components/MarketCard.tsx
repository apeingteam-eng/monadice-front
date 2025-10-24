"use client";

import Link from "next/link";

export type MarketOutcome = {
  label: string;
  percent: number; // 0–100
};

export type MarketSummary = {
  id: number;
  name: string;
  symbol: string;
  end_time: number;
  fee_bps: number;
  state: string;
  campaign_address: string;
  volumeUsd?: number;
  outcomes?: MarketOutcome[];
};

function formatUsdShort(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}b`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// Convert unix timestamp to “Ends in Xh Ymin” format
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
  const volume = market.volumeUsd ?? 190_000_000; // placeholder
  const outcomes =
    market.outcomes ?? [
      { label: "Yes", percent: 91 },
      { label: "No", percent: 9 },
    ];

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

  const countdown = formatCountdown(market.end_time);

  return (
    <Link
      href={`/market/${market.id}`}
      className="group rounded-lg border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-4 hover:shadow-md hover:border-accentPurple/40 transition-colors relative"
    >
      {/* Status Pill */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <span
          className={`inline-block w-2 h-2 rounded-full animate-pulse ${dotColor}`}
        ></span>
        <span className={`text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mb-3 text-sm text-neutral-500">
        {formatUsdShort(volume)} Vol.
      </div>

      {market.symbol && market.symbol !== "N/A" && (
        <div className="mb-2 inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-2.5 py-0.5 text-xs font-medium">
          {market.symbol}
        </div>
      )}

      <h3 className="mb-1 text-base font-semibold leading-snug group-hover:text-accentPurple">
        {market.name}
      </h3>
      <p className="text-xs text-neutral-500 mb-3">{countdown}</p>

      <div className="grid grid-cols-2 gap-2">
        {outcomes.map((o) => (
          <div
            key={o.label}
            className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 group-hover:bg-white group-hover:dark:bg-neutral-900"
          >
            <span className="text-neutral-700 dark:text-neutral-300">
              {o.label}
            </span>
            <span className="font-medium">{o.percent}%</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
