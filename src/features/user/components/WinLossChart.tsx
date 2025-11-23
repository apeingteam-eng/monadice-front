"use client";

type WinLossChartProps = {
  wins: number;
  losses: number;
};

export default function WinLossChart({ wins, losses }: WinLossChartProps) {
  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  // Gauge math
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const winStroke = (winRate / 100) * circumference;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center">
      <h3 className="text-lg font-semibold mb-4 text-white">Performance</h3>

      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="rgb(45,45,45)"
              strokeWidth="12"
              fill="transparent"
            />

            {/* Win arc */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="url(#winGradient)"
              strokeWidth="12"
              strokeDasharray={`${winStroke} ${circumference - winStroke}`}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />

            <defs>
              <linearGradient id="winGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#9b5de5" />
                <stop offset="100%" stopColor="#7a4edb" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-accentPurple">
              {winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-neutral-400">Win Rate</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-14 mt-4 text-sm text-neutral-300">
          <div className="text-center">
            <div className="text-accentPurple text-xl font-semibold">{wins}</div>
            <div className="text-xs text-neutral-500">Wins</div>
          </div>

          <div className="text-center">
            <div className="text-red-500 text-xl font-semibold">{losses}</div>
            <div className="text-xs text-neutral-500">Losses</div>
          </div>
        </div>
      </div>
    </div>
  );
}