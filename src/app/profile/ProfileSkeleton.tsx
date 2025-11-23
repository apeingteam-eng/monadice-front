"use client";

export default function ProfileSkeleton() {
  return (
    <div className="container mx-auto p-0 md:p-6 space-y-6 animate-pulse">
      
      {/* ===== TOP GRADIENT ===== */}
      <div className="relative overflow-hidden">
        <div className="h-28 w-full rounded-sm bg-neutral-800/80" />
      </div>

      {/* ===== PROFILE HEADER ===== */}
      <div className="px-6 -mt-10">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-neutral-800" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-32 bg-neutral-800 rounded" />
            <div className="h-4 w-48 bg-neutral-800 rounded" />
          </div>
        </div>
      </div>

      {/* ===== PORTFOLIO + STATS ===== */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-neutral-800 border border-neutral-700" />
        ))}
      </div>

      {/* ===== MAIN CONTENT GRID ===== */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* LEFT: Performance + Recent Bets */}
        <div className="md:col-span-2 space-y-4">
          <div className="h-56 rounded-xl bg-neutral-800 border border-neutral-700" />

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
            <div className="h-5 w-32 bg-neutral-800 rounded" />
            <div className="h-14 bg-neutral-800 rounded-xl" />
            <div className="h-14 bg-neutral-800 rounded-xl" />
          </div>
        </div>

        {/* RIGHT: Notes + Points + Referral */}
        <div className="md:col-span-1 space-y-4">

          <div className="h-32 rounded-xl bg-neutral-800 border border-neutral-700" />

          <div className="h-40 rounded-xl bg-neutral-800 border border-neutral-700" />

          <div className="h-40 rounded-xl bg-neutral-800 border border-neutral-700" />

        </div>
      </div>

      {/* ===== CREATED MARKETS ===== */}
      <div className="px-6 space-y-4">

        <div className="h-6 w-40 bg-neutral-800 rounded" />

        {/* Filter buttons */}
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-neutral-800" />
          ))}
        </div>

        {/* Market Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-neutral-800 rounded-xl border border-neutral-700" />
          <div className="h-48 bg-neutral-800 rounded-xl border border-neutral-700" />
        </div>
      </div>
    </div>
  );
}