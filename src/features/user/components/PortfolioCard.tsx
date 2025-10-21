export default function PortfolioCard() {
  const portfolioValue = 12500.45;
  const cash = 3200.0;
  return (
    <div className="rounded-xl p-[1px] bg-gradient-to-br from-accentPurple to-[#7a4edb]">
      <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
        <div className="text-xs uppercase tracking-wide text-accentPurple">Portfolio Value</div>
      <div className="text-2xl font-semibold mb-2">${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-400">Cash</span>
        <span>${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>
      </div>
    </div>
  );
}


