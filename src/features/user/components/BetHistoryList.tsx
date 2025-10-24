"use client";

import Link from "next/link";

export type Bet = {
  id: string | number;
  marketId?: string;
  marketTitle?: string;
  campaign_address?: string; // ✅ optional now
  outcome: string;
  stake: number;
  status: "Pending" | "Won" | "Lost";
  created_at?: string;
};

type BetHistoryListProps = {
  bets?: Bet[];
};

// Dummy fallback for visual state
const dummyBets: Bet[] = [
  {
    id: "b1",
    marketId: "btc-100k-2025",
    marketTitle: "Bitcoin to close above $100k in 2025",
    outcome: "Yes",
    stake: 250,
    status: "Pending",
  },
  {
    id: "b2",
    marketId: "nyc-mayor-2025",
    marketTitle: "New York City Mayoral Election",
    outcome: "No",
    stake: 100,
    status: "Won",
  },
  {
    id: "b3",
    marketId: "eth-etf-approval",
    marketTitle: "ETH Spot ETF approved by year-end",
    outcome: "Yes",
    stake: 75,
    status: "Lost",
  },
];

function StatusBadge({ status }: { status: Bet["status"] }) {
  const cls =
    status === "Won"
      ? "bg-accentPurple/15 text-accentPurple"
      : status === "Lost"
      ? "bg-red-500/15 text-red-400"
      : "bg-neutral-500/15 text-neutral-300";
  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{status}</span>;
}

export default function BetHistoryList({ bets }: BetHistoryListProps) {
  const displayBets = bets && bets.length > 0 ? bets : dummyBets;

  return (
    <div className="space-y-2 text-sm">
      {/* Header */}
      <div className="grid grid-cols-4 gap-2 text-xs text-neutral-500 px-2">
        <div>Market</div>
        <div>Outcome</div>
        <div>Stake</div>
        <div>Status</div>
      </div>

      {/* Table body */}
      <div className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 overflow-hidden">
        {displayBets.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-4 gap-2 items-center px-3 py-2 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
          >
            <Link
              href={`/market/${b.marketId || b.id}`}
              className="truncate hover:underline text-white"
            >
              {b.marketTitle ||
                (b.campaign_address
                  ? `${b.campaign_address.slice(0, 6)}…${b.campaign_address.slice(
                      -4
                    )}`
                  : "—")}
            </Link>
            <div>{b.outcome}</div>
            <div>${b.stake.toFixed(2)}</div>
            <div>
              <StatusBadge status={b.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-2">
        <button className="text-xs text-accentPurple hover:underline">
          View All
        </button>
      </div>
    </div>
  );
}
