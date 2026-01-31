"use client";

import { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/state/store";

import CreateBlitzMarket from "./CreateBlitzMarket";
import BlitzMarketCard, {
  BlitzMarketSummary,
} from "./BlitzMarketCard";
const DEMO_BLITZ_MARKET: BlitzMarketSummary = {
  id: -1,
  title: "Will BTC hit $100K this week?",
  end_time: Math.floor(Date.now() / 1000) + 60 * 60 * 6, // 6h
  state: "open",
  resolved: false,
  campaign_address: "0x0000000000000000000000000000000000000000",
  outcome_count: 3,
  total_volume: 12.4,
  total_participants: 28,
  is_whitelisted: false,
};
/* ------------------------------------------------------------
   PAGE
------------------------------------------------------------ */
export default function BlitzPage() {
  const [markets, setMarkets] = useState<BlitzMarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const query = useSelector((s: RootState) =>
    s.ui.searchQuery.toLowerCase().trim()
  );

  /* ---------------- FILTER STATE ---------------- */
  const [activeFilter, setActiveFilter] = useState<
    "All" | "Running" | "Pending" | "Ended"
  >("All");

  /* ---------------- LOAD MARKETS ---------------- */
  async function loadBlitzMarkets() {
    try {
      // Don't set global loading true on refresh to avoid flickering everything if desired, 
      // but simpler to just reload. Or we can have a separate 'refreshing' state.
      // For now keeping it simple as requested.
      // setLoading(true); 
      // Actually, better UX: only set loading on first load.
      if (markets.length === 0) setLoading(true);
      setError(false);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/blitz/all`
      );

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      // Expect: { status: "success", count: number, markets: [...] }
      if (data && Array.isArray(data.markets)) {
        setMarkets(data.markets);
      } else if (Array.isArray(data)) {
        // Fallback if direct array
        setMarkets(data);
      } else {
        setMarkets([]);
      }
    } catch (err) {
      console.error("Failed to load blitz markets:", err);
      setError(true);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBlitzMarkets();
  }, []);

  /* ---------------- FILTER LOGIC ---------------- */
  const filteredMarkets = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    return markets.filter((m) => {
      const matchesQuery =
        !query || m.name?.toLowerCase().includes(query) || m.symbol?.toLowerCase().includes(query);

      const isEnded = m.end_time <= now;
      const isOpen = m.state === "open";

      let status: "Running" | "Pending" | "Ended";

      if (isOpen && !isEnded) status = "Running";
      else if (isOpen && isEnded) status = "Pending";
      else status = "Ended";

      const matchesStatus =
        activeFilter === "All" || status === activeFilter;

      return matchesQuery && matchesStatus;
    });
  }, [markets, query, activeFilter]);

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-[#080808] w-full">
      <div className="container mx-auto px-4 py-10 space-y-10">
        {/* --------------------------------------------------
          TOP SECTION: VIDEO (Left) + CREATE (Right)
      -------------------------------------------------- */}
        {/* --------------------------------------------------
          TOP SECTION: VIDEO (Top) + CREATE (Bottom)
      -------------------------------------------------- */}
        <div className="flex flex-col items-center gap-12 max-w-5xl mx-auto">
          {/* TOP: Video */}
          <div className="relative w-full overflow-hidden">
            <video
              src="/blitz.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto object-cover opacity-80 mix-blend-screen scale-125"
            />
            {/* Seamless Blending Gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#080808] via-transparent to-[#080808] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-transparent to-[#080808] pointer-events-none" />
          </div>

          {/* BOTTOM: Create Form */}
          <div className="w-full">
            <CreateBlitzMarket onSuccess={loadBlitzMarkets} />
          </div>
        </div>

        {/* --------------------------------------------------
          LIST HEADER
      -------------------------------------------------- */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Blitz Markets</h1>
            <p className="text-xs text-neutral-400">
              Fast multi-outcome markets. Winner takes the pool.
            </p>
          </div>

          {/* STATUS FILTER */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {["All", "Running", "Pending", "Ended"].map((f) => (
              <button
                key={f}
                onClick={() =>
                  setActiveFilter(
                    f as "All" | "Running" | "Pending" | "Ended"
                  )
                }
                className={`
                px-3 py-1 text-xs rounded-full border transition whitespace-nowrap
                ${activeFilter === f
                    ? "border-accentPurple text-accentPurple bg-accentPurple/10"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }
              `}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* --------------------------------------------------
          MARKET GRID
      -------------------------------------------------- */}
        {loading ? (
          <p className="text-sm text-neutral-400">
            Loading blitz markets…
          </p>
        ) : error || filteredMarkets.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <BlitzMarketCard market={DEMO_BLITZ_MARKET} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarkets.map((m) => (
              <BlitzMarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}