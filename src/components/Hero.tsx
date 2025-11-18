// src/components/Hero.tsx
"use client";

import Link from "next/link";
import TopMarketHighlight from "@/components/TopMarketHighlight";
import type { MarketSummary } from "@/components/MarketCard";
import TopMarketSkeleton from "./TopMarketSkeleton";

export default function Hero({ markets }: { markets: MarketSummary[] }) {
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

      {/* GRID WRAPPER — SAME STRUCTURE AS HLX */}
     <div className="
  relative
  flex flex-col md:flex-row 
  items-center md:items-start 
  justify-start
  gap-6 md:gap-3
">
        {/* ---------------- LEFT SIDE ---------------- */}
        <div className="
          w-full 
          md:w-[45%]
          max-w-lg
          flex flex-col 
          text-center md:text-left
        ">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Bet on what’s next.
          </h1>

          <p className="text-neutral-400 text-base md:text-lg leading-relaxed mb-6 max-w-lg">
            Monadice is a crypto-native prediction market. Back your beliefs with
            on-chain bets across finance, sports, and more.
          </p>

          <div className="flex gap-4 justify-center md:justify-start">
            <Link
              href="/"
              className="rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-4 py-2 text-sm font-medium"
            >
              Explore markets
            </Link>

            <Link
              href="/create-market"
              className="rounded-md border border-neutral-800 bg-neutral-900 hover:border-accentPurple/40 text-neutral-100 px-4 py-2 text-sm"
            >
              Create market
            </Link>
          </div>
        </div>

        {/* ---------------- RIGHT SIDE (3D CARD) ---------------- */}
        <div className="
          w-full 
          md:w-[60%]
          flex justify-center md:justify-end
        ">
          <div className="w-full max-w-[420px]">
            <TopMarketHighlight markets={markets} />
          </div>
        </div>

      </div>
    </section>
  );
}