"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

/* ------------------------------------------------------------
   TYPES (from getAllBlitzMarkets API)
------------------------------------------------------------ */
export type BlitzMarketSummary = {
  id: number;
  campaign_address: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  choices: string[];
  outcome_count: number;
  end_time: number;
  state: "open" | "resolved" | "canceled";
  bet_token: string;
  permissioned: boolean;
  winning_outcome: number | null;
  whitelist: string[] | null;
};

/* ------------------------------------------------------------
   DEMO MARKET (fallback)
------------------------------------------------------------ */
export const DEMO_BLITZ_MARKET: BlitzMarketSummary = {
  id: -1,
  campaign_address: "0x0000000000000000000000000000000000000000",
  creator_wallet: "0x00...",
  name: "Will BTC hit $100K this week?",
  symbol: "BTC100K",
  choices: ["YES", "NO", "MAYBE"],
  outcome_count: 3,
  end_time: Math.floor(Date.now() / 1000) + 60 * 60 * 6,
  state: "open",
  bet_token: "0x0000000000000000000000000000000000000000",
  permissioned: false,
  winning_outcome: null,
  whitelist: null,
};

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */
function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endUnix - now;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h ${Math.floor((diff % 3600) / 60)}m left`;
}

function truncateAddress(addr: string) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------
   COMPONENT
------------------------------------------------------------ */
export default function BlitzMarketCard({
  market,
  disabled = false,
}: {
  market: BlitzMarketSummary;
  disabled?: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const isEnded = market.end_time <= now;

  /* ---------------- STATUS LOGIC ---------------- */
  let statusLabel = "Ended";
  let statusColor = "text-red-400";
  let dotColor = "bg-red-500";

  if (market.state === "open" && !market.winning_outcome && !isEnded) { // Changed market.resolved to market.winning_outcome as per type
    statusLabel = "Running";
    statusColor = "text-green-400";
    dotColor = "bg-green-500";
  } else if (market.state === "open" && market.winning_outcome) { // Changed market.resolved to market.winning_outcome as per type
    statusLabel = "Pending";
    statusColor = "text-yellow-400";
    dotColor = "bg-yellow-400";
  }

  const Wrapper: any = disabled ? "div" : Link;

  return (
    <Wrapper
      {...(!disabled && { href: `/blitz/market/${market.campaign_address}` })}
      // EXACT STYLE MATCH FROM MarketCard.tsx
      className={`
        group relative overflow-hidden rounded-xl
        border border-neutral-800/80 bg-neutral-900
        p-4 transition-all
        ${disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:border-accentPurple/40 hover:shadow-[0_0_25px_rgba(155,93,229,0.35)]"
        }
      `}
    >
      {/* Top Glow */}
      <div
        className="absolute inset-x-0 top-0 h-20 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(155,93,229,0.4), rgba(155,93,229,0) 70%)",
        }}
      />

      {/* Status */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <span
          className={`inline-block w-2 h-2 rounded-full animate-pulse ${dotColor}`}
        />
        <span className={`text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Symbol + Permission Badge */}
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-2.5 py-0.5 text-xs font-medium">
          {market.symbol || "BLITZ"}
        </div>

        {market.permissioned ? (
          <div className="inline-flex items-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold">
            PRIVATE
          </div>
        ) : (
          <div className="inline-flex items-center rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold">
            PUBLIC
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold text-neutral-200 group-hover:text-accentPurple transition-colors">
        {market.name}
      </h3>

      {/* Countdown */}
      <p className="text-xs text-neutral-500 mb-4">
        {formatCountdown(market.end_time)}
      </p>

      {/* Creator + Stats */}
      <div className="mb-4 flex items-center justify-between text-xs text-neutral-400 bg-neutral-950/50 rounded-lg p-2 border border-neutral-800/50">
        <div className="flex items-center gap-1">
          <span>Creator:</span>
          <span className="text-neutral-300 font-mono">{truncateAddress(market.creator_wallet)}</span>
        </div>
        <div>
          {market.outcome_count} Outcomes
        </div>
      </div>

      {/* CHOICES PREVIEW (Grid like Yes/No) */}
      <div className="grid grid-cols-2 gap-2">
        {market.choices?.slice(0, 2).map((choice, i) => (
          <div key={i} className="flex items-center justify-between rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm transition-all duration-300 hover:border-neutral-500 hover:shadow-[0_0_12px_rgba(255,255,255,0.05)]">
            <span className="text-neutral-300 truncate">{choice}</span>
            <span className="text-[10px] text-neutral-500">#{i + 1}</span>
          </div>
        ))}
        {/* If more than 2, show +X more */}
        {(market.choices?.length || 0) > 2 && (
          <div className="col-span-2 text-center text-[10px] text-neutral-500 pt-1">
            +{(market.choices?.length || 0) - 2} more outcomes
          </div>
        )}
      </div>
    </Wrapper>
  );
}