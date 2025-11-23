"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bet } from "./BetHistoryList";

const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);

export default function UserPerformanceAnalytics({ bets }: { bets: Bet[] }) {
  const total = bets.length;

  const wins = bets.filter((b) => b.status === "Won").length;
  const losses = bets.filter((b) => b.status === "Lost").length;
  const pending = bets.filter((b) => b.status === "Pending").length;
  const winRate = pct(wins, wins + losses);

  const byCategory = useMemo(() => {
    const map: Record<string, { wins: number; losses: number; total: number }> = {};
    bets.forEach((b) => {
      const cat = (b.category || "UNKNOWN").toUpperCase();
      if (!map[cat]) map[cat] = { wins: 0, losses: 0, total: 0 };

      map[cat].total++;
      if (b.status === "Won") map[cat].wins++;
      if (b.status === "Lost") map[cat].losses++;
    });
    return map;
  }, [bets]);

  const pnlSeries = bets
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((b, i) => ({ x: i, y: b.pnl }))
    .reduce(
      (acc, cur) => {
        const last = acc.length > 0 ? acc[acc.length - 1].y : 0;
        acc.push({ x: cur.x, y: last + cur.y });
        return acc;
      },
      [] as { x: number; y: number }[]
    );

  const maxY = Math.max(10, ...pnlSeries.map((p) => p.y));
  const minY = Math.min(-10, ...pnlSeries.map((p) => p.y));

  const scaleY = (val: number) =>
    90 - ((val - minY) / (maxY - minY)) * 90;

  const avgWinOdds = avg(bets.filter((b) => b.status === "Won").map((b) => b.payout ?? 0));
  const avgLossOdds = avg(bets.filter((b) => b.status === "Lost").map((b) => b.stake));

  return (
    <div className="space-y-6">

      {/* ===================================================== */}
      {/*           WIN RATE DONUT WITH HOVER GLOW               */}
      {/* ===================================================== */}
      <GlowBlock>
        <h3 className="text-base font-semibold mb-4">Performance</h3>

        <div className="flex items-center justify-center relative">
          <svg width="170" height="170" className="-rotate-90 smooth-animate">
            <circle
              cx="85"
              cy="85"
              r="65"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="14"
              fill="transparent"
            />

            <circle
              cx="85"
              cy="85"
              r="65"
              stroke="url(#donutGradient)"
              strokeWidth="14"
              strokeDasharray={`${(winRate / 100) * 2 * Math.PI * 65} ${
                2 * Math.PI * 65
              }`}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />

            <defs>
              <linearGradient id="donutGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#9b5de5" />
                <stop offset="100%" stopColor="#4cc9f0" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute text-center animate-fade-in">
            <div className="text-4xl font-bold bg-gradient-to-r from-accentPurple to-[#4cc9f0] text-transparent bg-clip-text">
              {winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-neutral-400">Win Rate</div>
          </div>
        </div>

        <div className="flex justify-center gap-10 mt-4 text-sm text-neutral-300 animate-fade-in">
          <StatMini label="Wins" value={wins} color="text-accentPurple" />
          <StatMini label="Losses" value={losses} color="text-red-500" />
          <StatMini label="Pending" value={pending} color="text-neutral-400" />
        </div>
      </GlowBlock>

      {/* ===================================================== */}
      {/*       CATEGORY BAR CHART WITH ANIMATION & HOVER       */}
      {/* ===================================================== */}
      <GlowBlock>
        <h3 className="text-base font-semibold mb-4">Win Rate by Category</h3>

        <div className="space-y-3">
          {Object.entries(byCategory).map(([cat, stats]) => {
            const rate = pct(stats.wins, stats.total);

            return (
              <div key={cat} className="animate-slide-up">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-neutral-300">{cat}</span>
                  <span className="text-accentPurple">{rate.toFixed(1)}%</span>
                </div>

                <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accentPurple to-[#4cc9f0] transition-all duration-1000 ease-out"
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlowBlock>

      {/* ===================================================== */}
      {/*                 PNL LINE GRAPH ANIMATED               */}
      {/* ===================================================== */}
      <GlowBlock>
        <h3 className="text-base font-semibold mb-4">PnL Over Time</h3>

        <svg width="100%" height="130" preserveAspectRatio="none" className="smooth-animate">
          <defs>
            <linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9b5de5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <polygon
            fill="url(#areaFade)"
            points={pnlSeries
              .map((p) => `${p.x * 40},${scaleY(p.y)}`)
              .join(" ") + ` ${pnlSeries.length * 40},130 0,130`}
            className="animate-fade-in"
          />

          {/* Animated line */}
          <polyline
            fill="none"
            stroke="#9b5de5"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-line animate-draw"
            points={pnlSeries.map((p) => `${p.x * 40},${scaleY(p.y)}`).join(" ")}
          />
        </svg>
      </GlowBlock>

      {/* ===================================================== */}
      {/*              ODDS SUMMARY – SMALL CARDS               */}
      {/* ===================================================== */}
      <GlowBlock>
        <h3 className="text-base font-semibold mb-2">Odds Summary</h3>

        <div className="grid grid-cols-2 gap-4 text-sm text-neutral-300">
          <SummaryTile label="Avg Win Odds" value={`${avgWinOdds.toFixed(2)}x`} />
          <SummaryTile label="Avg Loss Odds" value={`${avgLossOdds.toFixed(2)}x`} />
        </div>
      </GlowBlock>

      {/* ===================================================== */}
      {/*                      DONUT CHART                      */}
      {/* ===================================================== */}
      <DistributionChart bets={bets} />
    </div>
  );
}

/* --------------------------- BEAUTIFUL GLOW WRAPPER --------------------------- */

function GlowBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        rounded-xl border border-neutral-800 bg-neutral-900/60
        backdrop-blur-xl p-5 relative overflow-hidden
        transition-all duration-300
        hover:shadow-[0_0_35px_rgba(155,93,229,0.35)]
        hover:bg-neutral-900/70
      "
    >
      {/* Background bloom */}
      <div className="absolute inset-0 bg-gradient-to-br from-accentPurple/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* --------------------------- MINI STAT --------------------------- */

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div>{label}</div>
    </div>
  );
}

/* --------------------------- SUMMARY TILE --------------------------- */

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="
      rounded-lg bg-neutral-800/50 p-3 text-center shadow-inner
      transition-all duration-300 hover:shadow-[0_0_20px_rgba(155,93,229,0.25)]
    ">
      <div className="text-xl font-semibold text-accentPurple">{value}</div>
      <div className="text-neutral-400">{label}</div>
    </div>
  );
}

/* --------------------------- DONUT CHART --------------------------- */

function DistributionChart({ bets }: { bets: Bet[] }) {
  const categories = bets.reduce((acc: Record<string, number>, b) => {
    const c = (b.category || "UNKNOWN").toUpperCase();
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const total = bets.length;
  let offset = 0;

  const donutColors = ["#9b5de5", "#4cc9f0", "#f72585", "#4361ee", "#7209b7"];

  return (
    <GlowBlock>
      <h3 className="text-base font-semibold mb-4">Bet Distribution</h3>

      <div className="flex items-center gap-6">
        <svg width="140" height="140" viewBox="0 0 42 42" className="smooth-animate">
          {Object.entries(categories).map(([cat, count], i) => {
            const pct = (count / total) * 100;
            const dash = (pct / 100) * 131;
            const gap = 131 - dash;

            const element = (
              <circle
                key={cat}
                r="20"
                cx="21"
                cy="21"
                fill="transparent"
                stroke={donutColors[i % donutColors.length]}
                strokeWidth="5"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            );

            offset += dash;
            return element;
          })}
        </svg>

        <div className="text-sm text-neutral-300 space-y-2 animate-fade-in">
          {Object.entries(categories).map(([cat, count], i) => (
            <div key={cat} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ background: donutColors[i % donutColors.length] }}
              />
              {cat} — {count}
            </div>
          ))}
        </div>
      </div>
    </GlowBlock>
  );
}

/* --------------------------- HELPERS --------------------------- */
function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}