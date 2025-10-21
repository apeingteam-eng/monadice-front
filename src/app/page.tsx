"use client";
// Dummy data for now
// TODO: integrate real API
import { useMemo } from "react";
import MarketCard from "@/components/MarketCard";
import { dummyMarkets } from "@/data/dummyMarkets";
import Hero from "@/components/Hero";
import { useSelector } from "react-redux";
import type { RootState } from "@/state/store";

export default function Home() {
  const query = useSelector((s: RootState) => s.ui.searchQuery).toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!query) return dummyMarkets;
    return dummyMarkets.filter((m) =>
      m.title.toLowerCase().includes(query) || (m.category ?? "").toLowerCase().includes(query)
    );
  }, [query]);

  return (
    <>
      <Hero />
      <div className="container mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Markets</h1>
        <p className="text-xs text-neutral-400">Search to find markets by name or category</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
      </div>
    </>
  );
}
