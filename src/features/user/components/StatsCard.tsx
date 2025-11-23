"use client";

type StatsCardProps = {
  label: string;
  value: string | number;
};

export default function StatsCard({ label, value }: StatsCardProps) {
  return (
    <div
      className="
        relative rounded-xl 
        bg-neutral-900/70 
        border border-neutral-800 
        p-6
        flex flex-col items-center justify-center
        shadow-[0_0_20px_rgba(155,93,229,0.06)]
        hover:shadow-[0_0_28px_rgba(155,93,229,0.22)]
        backdrop-blur-sm
        transition-all duration-300
      "
    >
      {/* soft glow */}
      <div
        className="
          absolute inset-0 
          bg-gradient-to-br from-accentPurple/15 via-transparent to-transparent 
          rounded-xl pointer-events-none
        "
      />

      {/* Label */}
      <div
        className="
          text-[13px] 
          tracking-wide 
          uppercase 
          text-neutral-400 
          mb-3
        "
      >
        {label}
      </div>

      {/* Value */}
      <div
        className="
          text-[34px] 
          leading-tight
          font-bold 
          text-white
          drop-shadow-[0_0_12px_rgba(255,255,255,0.20)]
        "
      >
        {value}
      </div>
    </div>
  );
}