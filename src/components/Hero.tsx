// src/components/Hero.tsx
"use client";

import Link from "next/link";
import TopMarketHighlight from "@/components/TopMarketHighlight";
import type { MarketSummary } from "@/components/MarketCard";
import { useState } from "react";

export default function Hero({ markets }: { markets: MarketSummary[] }) {
    const [comingSoon, setComingSoon] = useState(false);
 const handleExploreClick = (e: React.MouseEvent) => {
    e.preventDefault(); // stop navigation
    setComingSoon(true);
    setTimeout(() => setComingSoon(false), 2000); // reset after 2s
  };
  return (
<section className="relative w-full overflow-hidden py-16 px-6 md:px-12 lg:px-30">

      {/* BACKGROUND GLOW */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(155,93,229,0.35) 0%, rgba(155,93,229,0) 70%)",
          }}
        />
      </div>

      {/* GRID WRAPPER */}
      <div className="relative flex flex-col md:flex-row items-center md:items-start justify-start gap-8 md:gap-12">

        {/* ---------------- LEFT SIDE ---------------- */}
        <div className="w-full md:w-[45%] max-w-lg flex flex-col text-center md:text-left">

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Bet on what’s next.
          </h1>

          <p className="text-neutral-400 text-base md:text-lg leading-relaxed mb-8 max-w-lg">
            Monadice is a crypto-native prediction market. Back your beliefs with
            on-chain bets across finance, sports, and more.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center md:justify-start">

            {/* ⭐ PRIMARY CTA — Create Market */}
            <Link
  href="/create-market"
  className="
    px-7 py-4          /* ⬆️ slightly bigger */
    rounded-xl text-sm font-semibold text-white
    bg-gradient-to-r from-accentPurple to-[#9D5BFF]
    shadow-[0_0_25px_rgba(155,93,229,0.7)]
    hover:shadow-[0_0_35px_rgba(155,93,229,1)]
    hover:scale-[1.05]   /* ⬆️ stronger hover pop */
    active:scale-[0.97]
    transition-all duration-200
  "
>
  Create Market
</Link>

            {/* Secondary CTA */}
            <button
  onClick={handleExploreClick}
  className="
    px-6 py-4 rounded-xl text-sm font-medium
    border border-neutral-700 bg-neutral-900
    text-neutral-200 hover:border-accentPurple/40
    transition
  "
>
  {comingSoon ? "Coming soon…" : "Explore Markets"}
</button>
          </div>
        </div>

        {/* ---------------- RIGHT SIDE ---------------- */}
        <div className="w-full md:w-[55%] flex justify-center md:justify-end mt-16 md:mt-0">
          <div className="w-full max-w-[420px]">
            <TopMarketHighlight markets={markets} />
          </div>
        </div>

      </div>
    </section>
  );
}