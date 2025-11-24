"use client";

import MarketCard, { MarketSummary } from "@/components/MarketCard";
import Link from "next/link";
import { useMemo, useEffect, useState } from "react";

export default function MarketsLayout({
  markets,
  loading,
}: {
  markets: MarketSummary[];
  loading: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);

  /* ---------------------- Derived Sections ---------------------- */

  const [joinedAddresses, setJoinedAddresses] = useState<string[]>([]);
  const [loadingJoined, setLoadingJoined] = useState(true);

  useEffect(() => {
    async function loadJoined() {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setJoinedAddresses([]);
          setLoadingJoined(false);
          return;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bet/me/user-bets`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          setJoinedAddresses([]);
          setLoadingJoined(false);
          return;
        }

        const data = await res.json();
        const addresses = data.bets.map((b: any) => b.campaign_address.toLowerCase());
        setJoinedAddresses(addresses);
      } catch {
        setJoinedAddresses([]);
      } finally {
        setLoadingJoined(false);
      }
    }

    loadJoined();
  }, []);

  const trending = useMemo(
    () => [...markets].sort((a, b) => b.volume - a.volume).slice(0, 6),
    [markets]
  );

  const endingSoon = useMemo(
    () =>
      markets
        .filter((m) => m.end_time > now && m.end_time - now < 6 * 3600)
        .slice(0, 6),
    [markets, now]
  );

  const newMarkets = useMemo(
    () =>
      markets
        .filter((m) => now - m.id < 24 * 3600)
        .slice(0, 6),
    [markets, now]
  );

  const yourMarkets = useMemo(
    () =>
      markets.filter((m) =>
        joinedAddresses.includes(m.campaign_address.toLowerCase())
      ),
    [markets, joinedAddresses]
  );

  /* ------------------------------ UI ------------------------------ */

  return (
    <div className="flex gap-8">
      {/* LEFT SIDEBAR ------------------------------------------- */}
      <aside className="hidden lg:block w-72 sticky top-20 h-screen overflow-y-auto pr-2">
        <h2 className="text-lg font-semibold mb-4">Your Markets</h2>

        {loadingJoined ? (
          <p className="text-neutral-500 text-sm">Loading…</p>
        ) : joinedAddresses.length === 0 ? (
          <p className="text-neutral-500 text-sm">Login to see your markets.</p>
        ) : yourMarkets.length === 0 ? (
          <p className="text-neutral-500 text-sm">You haven’t joined any markets yet.</p>
        ) : (
          <div className="space-y-3">
            {yourMarkets.map((m) => (
              <Link
                key={m.id}
                href={`/market/${m.id}`}
                className="block p-3 rounded-lg bg-neutral-900/80 border border-neutral-700 hover:border-accentPurple/40 hover:shadow-[0_0_15px_rgba(155,93,229,0.3)] transition"
              >
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-neutral-500">
                  {m.symbol} · {m.volume}$ Vol.
                </p>
              </Link>
            ))}
          </div>
        )}
      </aside>

      {/* MAIN CONTENT ------------------------------------------- */}
      <main className="flex-1">

        {/* TRENDING */}
        <Section title="🔥 Trending Markets" highlight>
          <Grid markets={trending} big />
        </Section>

        {/* ENDING SOON */}
        <Section title="⏳ Ending Soon">
          <Grid markets={endingSoon} />
        </Section>

        {/* NEW MARKETS */}
        <Section title="🆕 New Markets">
          <Grid markets={newMarkets} />
        </Section>

        {/* ALL MARKETS */}
        <Section title="🟪 All Markets">
          <Grid markets={markets} />
        </Section>
      </main>
    </div>
  );
}

/* -------- Section Wrapper -------- */

function Section({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="mb-12">
      <h2
        className={`text-xl font-semibold mb-4 ${
          highlight ? "text-accentPurple drop-shadow-[0_0_10px_rgba(155,93,229,0.5)]" : ""
        }`}
      >
        {title}
      </h2>

      {children}
    </div>
  );
}

/* -------- Grid Wrapper -------- */

function Grid({
  markets,
  big = false,
}: {
  markets: MarketSummary[];
  big?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 ${
        big
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-[300px]"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[240px]"
      }`}
    >
      {markets.map((m) => (
        <div
          key={m.id}
          className={`animate-[fadeInUp_0.4s_ease] ${
            big ? "lg:col-span-1 lg:row-span-2" : ""
          }`}
        >
          <MarketCard market={m} />
        </div>
      ))}
    </div>
  );
}