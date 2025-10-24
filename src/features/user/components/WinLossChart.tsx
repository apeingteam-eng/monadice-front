"use client";

type WinLossChartProps = {
  wins: number;
  losses: number;
};

export default function WinLossChart({ wins, losses }: WinLossChartProps) {
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  const lossRate = total > 0 ? ((losses / total) * 100).toFixed(1) : "0.0";

  // Circle math
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const winStroke = (Number(winRate) / 100) * circumference;
  const lossStroke = circumference - winStroke;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
      <h3 className="text-base font-semibold mb-3 text-white">Performance</h3>

      <div className="flex flex-col items-center">
        <svg width="100" height="100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="rgb(64,64,64)"
            strokeWidth="10"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="url(#winGradient)"
            strokeWidth="10"
            strokeDasharray={`${winStroke} ${lossStroke}`}
            strokeLinecap="round"
            fill="transparent"
          />
          <defs>
            <linearGradient id="winGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9b5de5" />
              <stop offset="100%" stopColor="#7a4edb" />
            </linearGradient>
          </defs>
        </svg>

        <div className="-mt-16 text-2xl font-bold text-accentPurple">
          {winRate}%
        </div>
        <p className="text-xs text-neutral-400 mb-3">Win Rate</p>

        <div className="flex justify-center gap-6 text-sm text-neutral-300">
          <div>
            <div className="text-accentPurple text-lg font-semibold">{wins}</div>
            <div>Wins</div>
          </div>
          <div>
            <div className="text-red-500 text-lg font-semibold">{losses}</div>
            <div>Losses</div>
          </div>
        </div>
      </div>
    </div>
  );
}
