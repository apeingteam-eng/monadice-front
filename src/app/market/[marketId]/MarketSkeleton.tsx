"use client";

export default function MarketSkeleton() {
  return (
    <div className="container mx-auto p-0 md:p-6 animate-pulse">

      {/* HEADER */}
      <div className="relative overflow-hidden mb-6">
        <div className="h-40 md:h-56 w-full rounded-xl bg-accentPurple/30" />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6">

        {/* LEFT PANEL */}
        <div className="md:col-span-2 space-y-5">

          {/* BADGES */}
          <div className="flex flex-wrap gap-3">
            <div className="h-6 w-16 rounded-full bg-neutral-800/60" />
            <div className="h-6 w-20 rounded-full bg-neutral-800/60" />
            <div className="h-6 w-20 rounded-full bg-neutral-800/60" />
          </div>

          {/* MARKET TITLE */}
          <div className="h-7 w-64 bg-neutral-800/60 rounded-md" />

          {/* CREATOR LINE */}
          <div className="h-4 w-80 bg-neutral-800/60 rounded-md" />

          {/* OUTCOME BUTTONS */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="h-12 rounded-md bg-neutral-800/60" />
            <div className="h-12 rounded-md bg-neutral-800/60" />
          </div>

          {/* ODDS + VOLUME BOXES */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
            <div className="h-20 rounded-xl bg-neutral-800/60" />
            <div className="h-20 rounded-xl bg-neutral-800/60" />
            <div className="h-20 rounded-xl bg-neutral-800/60" />
          </div>
        </div>

        {/* RIGHT PANEL (Bet form or Claim box) */}
        <div className="md:col-span-1">
          <div className="h-48 rounded-xl bg-neutral-800/60" />
        </div>
      </div>

      {/* TICKET GALLERY */}
      <div className="px-6 mt-10">
        <div className="h-6 w-48 bg-neutral-800/60 rounded-md mb-4" />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-40 rounded-xl bg-neutral-800/60" />
          ))}
        </div>
      </div>

    </div>
  );
}