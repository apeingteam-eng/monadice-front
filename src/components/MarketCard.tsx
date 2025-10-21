import Link from "next/link";

export type MarketOutcome = {
  label: string;
  percent: number; // 0-100
};

export type MarketSummary = {
  id: string;
  title: string;
  outcomes: MarketOutcome[];
  volumeUsd: number; // e.g., 190000000
  category?: string;
};

function formatUsdShort(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}b`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

type Props = {
  market: MarketSummary;
};

export default function MarketCard({ market }: Props) {
  return (
    <Link
      href={`/market/${market.id}`}
      className="group rounded-lg border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-4 hover:shadow-md hover:border-accentPurple/40 transition-colors"
    >
      <div className="mb-3 text-sm text-neutral-500">{formatUsdShort(market.volumeUsd)} Vol.</div>
      {market.category ? (
        <div className="mb-2 inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-2.5 py-0.5 text-xs font-medium">
          {market.category}
        </div>
      ) : null}
      <h3 className="mb-3 text-base font-semibold leading-snug group-hover:text-accentPurple">{market.title}</h3>
      <div className="grid grid-cols-2 gap-2">
        {market.outcomes.map((o) => (
          <div
            key={o.label}
            className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 group-hover:bg-white group-hover:dark:bg-neutral-900"
          >
            <span className="text-neutral-700 dark:text-neutral-300">{o.label}</span>
            <span className="font-medium">{o.percent}%</span>
          </div>
        ))}
      </div>
    </Link>
  );
}


