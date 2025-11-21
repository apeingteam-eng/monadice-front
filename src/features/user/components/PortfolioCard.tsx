// src/features/user/components/PortfolioCard.tsx
type PortfolioCardProps = {
  portfolioValue: number;
  cash: number;
};

export default function PortfolioCard({ portfolioValue, cash }: PortfolioCardProps) {
  return (
    <div className="rounded-xl border border-accentPurple/40 bg-neutral-900 p-4 text-center">
      <div className="text-xs uppercase text-accentPurple tracking-wide mb-1">
        Portfolio Value
      </div>

      <div className="text-2xl font-semibold text-white">
        ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>

      <div className="text-sm text-neutral-400 mt-1">
        Cash ${cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}