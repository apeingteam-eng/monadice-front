"use client";

import { useMemo } from "react";
import Image from "next/image";
import MarketCard, { MarketSummary } from "@/components/MarketCard";

/* -------------------------------------------------------------------------- */
/* SUB-COMPONENTS                              */
/* -------------------------------------------------------------------------- */

const CategoryBanner = ({
  title,
  alignment,
  imageSrc,
}: {
  title: string;
  alignment: "left" | "right";
  imageSrc: string;
}) => (
  <div
    className={`
      hidden lg:flex 
      w-[160px] h-[400px]
      shrink-0 
      items-center justify-center 
      rounded-xl border border-neutral-800 bg-neutral-900 
      relative overflow-hidden
      group
      shadow-2xl shadow-black/50
    `}
  >
    <Image
      src={imageSrc}
      alt={`${title} Banner`}
      fill
      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
      sizes="(max-width: 768px) 0vw, 160px"
    />
    {/* Gradient Overlay */}
    
    <div
      className={`absolute top-0 bottom-0 w-1 bg-accentPurple/50 z-10 ${
        alignment === "left" ? "right-0" : "left-0"
      }`}
    />
  </div>
);

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  { id: "CRYPTO", label: "Crypto", align: "left", img: "/cryptoBanner.png" },
  { id: "SPORTS", label: "Sports", align: "right", img: "/sportsBanner.png" },
  { id: "SOCIAL", label: "Social", align: "left", img: "/socialBanner.png" },
  { id: "POLITICS", label: "Politics", align: "right", img: "/politicBanner.png" },
  
] as const;

export default function TopMarketsByCategory({ markets }: { markets: MarketSummary[] }) {
  
  // Logic: Prefer Running (by Vol), then fill with Ended (by Vol)
  const categoryData = useMemo(() => {
    const data: Record<string, MarketSummary[]> = {};
    const now = Math.floor(Date.now() / 1000);

    CATEGORIES.forEach((cat) => {
      // 1. Filter by Category
      const allInCat = markets.filter((m) => m.symbol?.toUpperCase() === cat.id);

      // 2. Split into 'Running' and 'Others' (Ended/Pending)
      const running: MarketSummary[] = [];
      const others: MarketSummary[] = [];

      allInCat.forEach((m) => {
        const isRunning = m.state === "open" && !m.resolved && m.end_time > now;
        if (isRunning) {
          running.push(m);
        } else {
          others.push(m);
        }
      });

      // 3. Sort both groups by Volume High -> Low
      running.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      others.sort((a, b) => (b.volume || 0) - (a.volume || 0));

      // 4. Merge: Running first, then Others
      const combined = [...running, ...others];

      // 5. Take top 3
      data[cat.id] = combined.slice(0, 3);
    });

    return data;
  }, [markets]);

  const validCategories = CATEGORIES.filter(
    (cat) => categoryData[cat.id] && categoryData[cat.id].length > 0
  );

  if (validCategories.length === 0) return null;

  return (
    <div className="container mx-auto px-6 pt-12 pb-32"> 
      {validCategories.map((cat, index) => {
        const topMarkets = categoryData[cat.id];
        const isFirst = index === 0;

        return (
          <section
            key={cat.id}
            className={`
              relative w-full
              /* Overlap Logic */
              ${isFirst ? "mt-0 z-0" : "-mt-12 lg:-mt-20 z-10"} 
              pointer-events-none 
            `}
            style={{ zIndex: index }}
          >
            {/* Header */}
            <div
              className={`
              flex items-center gap-4 mb-8 pointer-events-auto
              ${cat.align === "right" ? "lg:justify-end" : ""}
            `}
            >
              {cat.align === "right" && (
                <div className="hidden lg:block h-px bg-neutral-800 flex-1 max-w-[200px]" />
              )}
              
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2 relative z-10 bg-neutral-950/80 backdrop-blur-md px-4 py-1 rounded-full border border-white/5 shadow-lg">
                <span className="text-accentPurple"></span> {cat.label}
              </h2>

              {cat.align === "left" && (
                <div className="h-px bg-neutral-800 flex-1 max-w-[200px]" />
              )}
            </div>

            {/* Content Container */}
            <div
              className={`
                flex flex-col gap-8 pointer-events-auto
                lg:items-center 
                ${cat.align === "left" ? "lg:flex-row" : "lg:flex-row-reverse"}
              `}
            >
              <CategoryBanner
                title={cat.label}
                alignment={cat.align}
                imageSrc={cat.img}
              />

              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {topMarkets.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}