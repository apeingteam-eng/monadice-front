"use client";

import { useEffect, useState, useMemo } from "react";
import MarketCard, { MarketSummary } from "@/components/MarketCard";
import Hero from "@/components/Hero";
import TopMarketsByCategory from "@/components/TopMarketsByCategory"; // <--- IMPORT THIS
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


  // Capture referral code from URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    if (ref) {
      localStorage.setItem("referral_code", ref);
    }
  }, []);

  useEffect(() => {
    async function loadMarkets() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/campaigns`);
        const data = await res.json();

        setMarkets(data); 
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
      <div className="relative z-0 overflow-hidden">
        <Hero markets={markets} />
      </div>

      {/* --- NEW SECTION: Top Markets By Category --- */}
      {/* Only show if not loading and we have markets */}
      {!loading && markets.length > 0 && (
         // CHANGED: Removed 'bg-black/20' so it isn't "deep dark"
         // It will now just use the page's natural background color
         <div>
            <TopMarketsByCategory markets={markets} />
         </div>
      )}

      {/* --- EXISTING SECTION: Main Grid --- */}
      <div className="container mx-auto p-6 mt-8">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">All Markets</h1>
            <p className="text-xs text-neutral-400">
              Filter markets by status, or category
            </p>
          </div>

          {/* FILTERS */}
          <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            {/* STATUS FILTER */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 flex-nowrap">
              {["All", "Running", "Pending", "Ended"].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f as "All" | "Running" | "Pending" | "Ended")}
                  className={`
                    px-3 py-1 text-xs rounded-full border transition whitespace-nowrap
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
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 flex-nowrap">
              {["All", "SPORTS", "CRYPTO", "POLITICS", "SOCIAL"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat as "All" | "SPORTS" | "CRYPTO" | "POLITICS" | "SOCIAL")}
                  className={`
                    px-3 py-1 text-xs rounded-full border transition whitespace-nowrap
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

        {/* Markets Grid */}
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