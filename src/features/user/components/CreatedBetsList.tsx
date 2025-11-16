"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Contract, JsonRpcProvider } from "ethers";
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network";

type OnchainStats = {
  yesPercent: number;
  noPercent: number;
  volume: number;
  fees: number;
};

export interface CreatedCampaign {
  id: number;
  name: string;
  symbol: string;
  campaign_address: string;
  end_time: number;
  state: string; // open | resolved | canceled
  outcome_true: boolean | null;
  fee_bps: number;
}

interface Props {
  campaigns: CreatedCampaign[];
}

/* ------------ Formatting helpers ------------ */

function formatUsdShort(n: number) {
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

/* ------------ Component ------------ */

export default function CreatedBetsList({ campaigns }: Props) {
  const router = useRouter();
  const now = Math.floor(Date.now() / 1000);

  const [activeFilter, setActiveFilter] = useState<"All" | "Running" | "Pending" | "Ended" | "Cancelled">("All");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "SPORTS" | "CRYPTO" | "POLITICS" | "SOCIAL">("All");

  const [onchain, setOnchain] = useState<Record<string, {
    yesPercent: number;
    noPercent: number;
    volume: number;
    fees: number;
  }>>({});

  /* On-chain loading */
  useEffect(() => {
    async function load() {
      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      
      const results: Record<string, OnchainStats> = {};

      for (const c of campaigns) {
        try {
          const contract = new Contract(c.campaign_address, BetCampaignABI, provider);
          const divisor = 1e6;

          const tTrueRaw = await contract.totalTrue().catch(() => 0n);
          const tFalseRaw = await contract.totalFalse().catch(() => 0n);
          const tPotRaw = await contract.totalInitialPot().catch(() => 0n);

          const yes = Number(tTrueRaw) / divisor;
          const no = Number(tFalseRaw) / divisor;
          const pot = Number(tPotRaw) / divisor;

          const total = yes + no;
          const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
          const noPct = total > 0 ? Math.round((no / total) * 100) : 50;

          const totalVol = yes + no + pot;
          const fees = (totalVol * c.fee_bps) / 10_000;

          results[c.campaign_address] = { yesPercent: yesPct, noPercent: noPct, volume: totalVol, fees };
        } catch {}
      }

      setOnchain(results);
    }

    load();
  }, [campaigns]);

  /* Enrich with status */
  const enriched = campaigns.map((c) => {
    const endedByTime = c.end_time <= now;

    const status =
      c.state === "canceled"
        ? "Cancelled"
        : c.state === "resolved"
        ? "Ended"
        : !endedByTime
        ? "Running"
        : "Pending";

    return { ...c, status };
  });

  /* FILTER LOGIC */
  const filtered = enriched.filter((c) => {
    const statusMatch = activeFilter === "All" || c.status === activeFilter;
    const categoryMatch = categoryFilter === "All" || c.symbol?.toUpperCase() === categoryFilter;
    return statusMatch && categoryMatch;
  });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-6 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
        <h3 className="text-base font-semibold">My Created Markets</h3>

        <div className="flex flex-col lg:flex-row gap-3">

          <div className="flex gap-2">
            {["All", "Running", "Pending", "Ended", "Cancelled"].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f as "All" | "Running" | "Pending" | "Ended" | "Cancelled")}
                className={`
                  px-3 py-1 text-xs rounded-full border transition
                  ${
                    activeFilter === f
                      ? "border-accentPurple text-accentPurple bg-accentPurple/10"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }
                `}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="hidden lg:block w-px bg-neutral-700"></div>

          <div className="flex gap-2">
            {["All", "SPORTS", "CRYPTO", "POLITICS", "SOCIAL"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat as "All" | "SPORTS" | "CRYPTO" | "POLITICS" | "SOCIAL")}
                className={`
                  px-3 py-1 text-xs rounded-full border transition
                  ${
                    categoryFilter === cat
                      ? "border-accentPurple text-accentPurple bg-accentPurple/10"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }
                `}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-neutral-500 text-sm">No markets match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const stats: OnchainStats | undefined = onchain[c.campaign_address];

            return (
              <div
                key={c.id}
                onClick={() => router.push(`/market/${c.id}`)}
                className="cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 p-5 hover:border-accentPurple/40 transition relative"
              >
                {/* STATUS */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      c.status === "Running"
                        ? "bg-green-400"
                        : c.status === "Pending"
                        ? "bg-yellow-400"
                        : c.status === "Ended"
                        ? "bg-purple-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span className="text-xs text-neutral-300">{c.status}</span>
                </div>

                {/* SYMBOL */}
                {c.symbol && (
                  <div className="inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-3 py-1 text-xs font-medium mb-2">
                    {c.symbol}
                  </div>
                )}

                {/* TITLE */}
                <h4 className="text-base font-semibold text-neutral-200 mb-1">
                  {c.name}
                </h4>

                {/* ADDRESS */}
                <p className="text-xs text-neutral-500 font-mono mb-3">
                  {c.campaign_address.slice(0, 6)}…{c.campaign_address.slice(-4)}
                </p>

                {/* COUNTDOWN */}
                <p className="text-xs text-neutral-500 mb-3">
                  {formatCountdown(c.end_time)}
                </p>

                {/* ONCHAIN */}
                {stats && (
                  <>
                    <p className="text-xs text-neutral-400 mb-2">
                      Volume: <span className="text-neutral-200">{formatUsdShort(stats.volume)}</span>{" "}
                      • Fees Earned: <span className="text-green-400">{formatUsdShort(stats.fees)}</span>
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
                        <span className="text-neutral-300">Yes</span>
                        <span className="font-medium text-neutral-100">{stats.yesPercent}%</span>
                      </div>

                      <div className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm">
                        <span className="text-neutral-300">No</span>
                        <span className="font-medium text-neutral-100">{stats.noPercent}%</span>
                      </div>
                    </div>
                  </>
                )}

                {/* OUTCOME (If Ended) */}
                {c.state === "resolved" && c.outcome_true !== null && (
                  <p className="text-xs mt-3 text-neutral-400">
                    Outcome:{" "}
                    <span className={c.outcome_true ? "text-green-400" : "text-red-400"}>
                      {c.outcome_true ? "YES" : "NO"}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}