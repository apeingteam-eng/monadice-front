export default function TopMarketSkeleton() {
  return (
    <div
      className="
        w-full max-w-sm mx-auto
        rounded-2xl
        border border-neutral-800
        bg-neutral-900
        p-6
        shadow-xl
        relative overflow-hidden
        animate-pulse
      "
    >
      {/* Glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accentPurple/20 blur-[100px]" />
      </div>

      {/* Top Badge */}
      <div className="absolute top-4 left-4 h-5 w-20 bg-neutral-800 rounded-full" />

      {/* Status */}
      <div className="absolute top-4 right-4 h-4 w-16 bg-neutral-800 rounded-full" />

      {/* Volume */}
      <div className="h-4 w-24 bg-neutral-800 rounded mt-8" />

      {/* Symbol */}
      <div className="h-5 w-16 bg-neutral-800 rounded-full mt-3" />

      {/* Title */}
      <div className="h-6 w-40 bg-neutral-800 rounded mt-3" />

      {/* Countdown */}
      <div className="h-4 w-24 bg-neutral-800 rounded mt-2" />

      {/* Yes / No Row */}
      <div className="grid grid-cols-2 gap-2 mt-5">
        <div className="h-10 w-full bg-neutral-800 rounded-md" />
        <div className="h-10 w-full bg-neutral-800 rounded-md" />
      </div>
    </div>
  );
}