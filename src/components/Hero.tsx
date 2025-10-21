// src/components/Hero.tsx
"use client";

import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-25"
          style={{
            background:
              "radial-gradient(circle, #9B5DE5 0%, rgba(155,93,229,0) 60%)",
          }}
        />
      </div>

      <div className="container mx-auto px-6 py-10 md:py-16">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight mb-3">
          Bet on what’s next.
        </h1>
        <p className="text-sm md:text-base text-neutral-400 max-w-2xl mb-6">
          Monadice is a crypto-native prediction market. Back your beliefs with
          on-chain bets across finance, sports, and more.
        </p>

        <div className="flex items-center gap-3">
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
    </section>
  );
}
