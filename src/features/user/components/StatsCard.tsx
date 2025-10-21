type StatsCardProps = {
  label: string;
  value: string | number;
};

export default function StatsCard({ label, value }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 p-4 text-center bg-neutral-900/80">
      <div className="text-xs uppercase tracking-wide text-accentPurple">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}


