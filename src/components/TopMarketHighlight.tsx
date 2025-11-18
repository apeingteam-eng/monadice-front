"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Contract, JsonRpcProvider } from "ethers";
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network";
import type { MarketSummary } from "@/components/MarketCard";
import TopMarketSkeleton from "./TopMarketSkeleton";

/* ---------- Helpers ---------- */

function formatUsdShort(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(endUnix - now, 0);

  if (diff <= 0) return "Ended";

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours === 0) return `Ends in ${minutes}m`;
  return `Ends in ${hours}h ${minutes}m`;
}

/* ---------- Component ---------- */

export default function TopMarketHighlight({ markets }: { markets: MarketSummary[] }) {
  const [top, setTop] = useState<MarketSummary | null>(null);
  const [volume, setVolume] = useState(0);
  const [yesPercent, setYesPercent] = useState(50);
  const [noPercent, setNoPercent] = useState(50);

  const cardRef = useRef<HTMLDivElement>(null);
const [frame, setFrame] = useState(0);

useEffect(() => {
  const total = 145; // number of frames
  let f = 0;

  const interval = setInterval(() => {
    f = (f + 1) % total;
    setFrame(f);
  }, 33); // 30 fps

  return () => clearInterval(interval);
}, []);
  /* ------------------------------------------
       Load top market based on volume
  ------------------------------------------ */
  useEffect(() => {
    if (!markets.length) return;

    async function getTop() {
      const provider = new JsonRpcProvider(CHAIN.rpcUrl);

      let best: MarketSummary | null = null;
      let bestVol = -1;

      for (const m of markets) {
        try {
          const contract = new Contract(m.campaign_address, BetCampaignABI, provider);
          const div = 1e6;

          const tTrue = Number(await contract.totalTrue().catch(() => 0n)) / div;
          const tFalse = Number(await contract.totalFalse().catch(() => 0n)) / div;
          const tPot = Number(await contract.totalInitialPot().catch(() => 0n)) / div;

          const vol = tTrue + tFalse + tPot;
          if (vol > bestVol) {
            bestVol = vol;
            best = m;
          }
        } catch (_) {}
      }

      if (best) {
        setTop(best);
        setVolume(bestVol);
      }
    }

    getTop();
  }, [markets]);

  /* ------------------------------------------
        Load YES / NO %
  ------------------------------------------ */
 useEffect(() => {
  if (!top) return;

  const m = top; // ← local copy eliminates the null error

  async function loadPercents() {
    try {
      const provider = new JsonRpcProvider(CHAIN.rpcUrl);
      const contract = new Contract(m.campaign_address, BetCampaignABI, provider);

      const div = 1e6;
      const tTrue = Number(await contract.totalTrue().catch(() => 0n)) / div;
      const tFalse = Number(await contract.totalFalse().catch(() => 0n)) / div;

      const total = tTrue + tFalse;

      setYesPercent(total > 0 ? Math.round((tTrue / total) * 100) : 50);
      setNoPercent(total > 0 ? Math.round((tFalse / total) * 100) : 50);
    } catch {}
  }

  loadPercents();
}, [top]);
 

/* ------------------------------------------
      PREMIUM INERTIA-BASED 3D TILT
------------------------------------------ */
useEffect(() => {
  const el = cardRef.current;
  if (!el) return;

  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  const animate = () => {
    currentX += (targetX - currentX) * 0.15;
    currentY += (targetY - currentY) * 0.15;

    el.style.transform = `
      perspective(1000px)
      rotateX(${currentY}deg)
      rotateY(${currentX}deg)
      scale(1.04)
    `;

    requestAnimationFrame(animate);
  };

  animate();

  const handleMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    targetY = -(y - 0.5) * 20;
    targetX = (x - 0.5) * 20;
  };

  const reset = () => {
    targetX = 0;
    targetY = 0;
  };

  el.addEventListener("mousemove", handleMove);
  el.addEventListener("mouseleave", reset);

  return () => {
    el.removeEventListener("mousemove", handleMove);
    el.removeEventListener("mouseleave", reset);
  };
}, []);
    const market = top;
if (!top) {
  return (
    <div ref={cardRef}>
      <TopMarketSkeleton />
    </div>
  );
}
 if (!market) return null;
  /* ------------------------------------------
        UI – Clean 3D Card
  ------------------------------------------ */
/* -------- Floating Animation Style -------- */
const floatyStyle = (
  <style>
    {`
      @keyframes floaty {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-4px); }
        100% { transform: translateY(0px); }
      }
    `}
  </style>
);return (
  <>
    {floatyStyle}

    <div
      ref={cardRef}
      className="relative transition-all duration-300 animate-[floaty_5s_ease-in-out_infinite]"
    >
<Link
  href={`/market/${market.id}`}
  className="
    card-with-purple-flame
    purple-flame-bg
    block 
    w-full max-w-sm mx-auto
    rounded-2xl
    border border-neutral-800 
    bg-neutral-900
    p-6
    shadow-2xl
    relative
    overflow-visible
    transition-all duration-300
    hover:shadow-[0px_0px_65px_rgba(155,93,229,0.45)]
    hover:scale-[1.06]
    hover:-translate-y-[6px]
    hover:border-accentPurple/40
  "
>
{/* 🔥 PNG frame-based flame */}
<div className="absolute inset-0 pointer-events-none -z-10 flex justify-center items-center overflow-visible">
 <img
  src={`/flames/prupleflame${String(frame).padStart(3, "0")}.png`}
  className="w-[600px] h-[500px] max-w-none object-contain opacity-90 translate-x-[10px] translate-y-[4px]"
  alt="flame"
/>
</div> 

 {/* 🔥 Flame directly under card */}
    <div className="purple-real-flames absolute left-0 right-0 -bottom-10 mx-auto"></div>

    {/* Purple Glow */}
    <div className="absolute inset-0 -z-10">
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accentPurple/30 blur-[90px]" />
    </div>
        {/* Status */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${market.state === "open" ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-neutral-300">
            {market.state === "open" ? "Running" : "Ended"}
          </span>
        </div>

        {/* Badge */}
        <div className="absolute top-4 left-25 bg-red-600/40 text-red-200 text-xs font-semibold px-2 py-1 rounded-full">
          🔥 Top Market
        </div>

        {/* Volume */}
        <div className="text-sm text-neutral-400">{formatUsdShort(volume)} Vol.</div>

        {/* Symbol */}
        <div className="inline-flex mt-2 bg-accentPurple/15 text-accentPurple px-2.5 py-0.5 text-xs rounded-full">
          {market.symbol}
        </div>

        {/* Title */}
        <h3 className="mt-2 text-xl font-semibold">{market.name}</h3>

        {/* Countdown */}
        <p className="text-xs text-neutral-500 mt-1">
          {formatCountdown(market.end_time)}
        </p>

        {/* YES / NO */}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <div className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm flex justify-between">
            <span>Yes</span><span className="font-medium">{yesPercent}%</span>
          </div>
          <div className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm flex justify-between">
            <span>No</span><span className="font-medium">{noPercent}%</span>
          </div>
        </div>

      </Link>
    </div>
  </>
);}