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
    if (!query) return markets;
    return markets.filter(
      (m) =>
        m.name?.toLowerCase().includes(query) ||
        m.symbol?.toLowerCase().includes(query)
    );
  }, [markets, query]);

  return (
    <>
      <Hero />
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Markets</h1>
          <p className="text-xs text-neutral-400">
            Search to find markets by name or category
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-400">Loading campaigns…</p>
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
