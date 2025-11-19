"use client";

import { useEffect, useState, useMemo } from "react";
import MarketCard, { MarketSummary } from "@/components/MarketCard";
import Hero from "@/components/Hero";
import { useSelector } from "react-redux";
import type { RootState } from "@/state/store";

export default function Home() {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const query = useSelector((s: RootState) => s.ui.searchQuery).toLowerCase().trim();

  // NEW FILTER STATES
  const [activeFilter, setActiveFilter] = useState<
    "All" | "Running" | "Pending" | "Ended"
  >("All");

  const [categoryFilter, setCategoryFilter] = useState<
    "All" | "SPORTS" | "CRYPTO" | "POLITICS" | "SOCIAL"
  >("All");

useEffect(() => {
  async function loadMarkets() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/campaigns`);
      const data = await res.json();

      setMarkets(data); // ← direct use
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  }
  loadMarkets();
}, []);

  const filtered = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    return markets.filter((m) => {
      const matchesQuery =
        !query ||
        m.name?.toLowerCase().includes(query) ||
        m.symbol?.toLowerCase().includes(query);

      const isEnded = m.end_time <= now;
      const isOpen = m.state === "open";

      let status: "Running" | "Pending" | "Ended";

      if (isOpen && !isEnded) status = "Running";
      else if (isOpen && isEnded) status = "Pending";
      else status = "Ended";

      const matchesStatus = activeFilter === "All" || status === activeFilter;

      const matchesCategory =
        categoryFilter === "All" || m.symbol?.toUpperCase() === categoryFilter;

      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [markets, query, activeFilter, categoryFilter]);

  /* --------------------------------- UI ---------------------------------- */
  return (
    <>
      <Hero markets={markets} />
      <div className="container mx-auto p-6">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Markets</h1>
            <p className="text-xs text-neutral-400">
              Search or filter markets by name, status, or category
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-col lg:flex-row gap-3">

            {/* STATUS FILTER */}
            <div className="flex gap-2">
              {["All", "Running", "Pending", "Ended"].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f as "All" | "Running" | "Pending" | "Ended")}
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

            {/* Vertical Separator on desktop */}
            <div className="hidden lg:block w-px bg-neutral-700"></div>

            {/* CATEGORY FILTER */}
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

        {/* Markets */}
        {loading ? (
          <p className="text-sm text-neutral-400">Loading campaigns…</p>
        ) : filtered.length === 0 ? (
          <p className="text-neutral-500 text-sm">No markets match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}