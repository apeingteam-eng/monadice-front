"use client";

type PortfolioCardProps = {
  portfolioValue: number;
  cash: number;
};

export default function PortfolioCard({ portfolioValue, cash }: PortfolioCardProps) {
  const inPlay = portfolioValue - cash;

  return (
    <div
      className="
        relative
        rounded-2xl 
        p-5 
        bg-neutral-900/50 
        border border-accentPurple/40 
        shadow-[0_0_25px_rgba(155,93,229,0.25)]
        backdrop-blur-xl
        overflow-hidden
      "
    >
      {/* Glowing blur behind content */}
      <div className="absolute inset-0 bg-gradient-to-br from-accentPurple/20 to-transparent blur-2xl opacity-50" />

      {/* Content */}
      <div className="relative z-10 text-center">

        {/* Label */}
        <div className="text-xs tracking-wide text-accentPurple uppercase mb-2">
          Portfolio Value
        </div>

        {/* Main Number */}
        <div
          className="
            text-4xl 
            font-extrabold 
            bg-gradient-to-r from-accentPurple to-[#4cc9f0] 
            text-transparent bg-clip-text 
            drop-shadow-[0_0_10px_rgba(155,93,229,0.45)]
          "
        >
          ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>

        {/* Mini Sparkline Chart */}
        <svg width="100%" height="40" className="mt-3 opacity-70">
          <polyline
            points="0,25 20,20 40,23 60,18 80,10 100,15 120,8"
            fill="none"
            stroke="url(#sparkGrad)"
            strokeWidth="2"
          />
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#9b5de5" />
              <stop offset="100%" stopColor="#4cc9f0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Breakdown */}
        <div className="flex justify-between text-sm mt-4 text-neutral-300">

          <div className="text-left">
            <div className="text-xs text-neutral-500">Cash</div>
            <div className="font-semibold text-white">
              ${cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-neutral-500">In-Play</div>
            <div className="font-semibold text-accentPurple">
              ${inPlay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}