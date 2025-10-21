// Dummy data for now
// TODO: integrate real API
// TODO: integrate on-chain contract call via ethers on the action button
import { getDummyMarketById } from "@/data/dummyMarkets";

type Props = { params: { marketId: string } };

export default function MarketPage({ params }: Props) {
  const market = getDummyMarketById(params.marketId);
  if (!market) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-xl font-semibold">Market not found</h1>
      </div>
    );
  }

  const handlePlaceBet = async (formData: FormData) => {
    'use server';
    const amount = formData.get("amount");
    const outcome = formData.get("outcome");
    // TODO: integrate on-chain contract call via ethers on the action button
    console.log("place bet:", { marketId: market.id, amount, outcome });
  };

  return (
    <div className="container mx-auto p-0 md:p-6">
      {/* Gradient header */}
      <div className="relative overflow-hidden">
        <div className="h-40 md:h-56 w-full grid place-items-center" style={{ background: 'linear-gradient(135deg, #9b5de5 0%, #7a4edb 100%)' }}>
          <span className="text-white/90 text-sm">Market</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        {/* Left: details */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-3 py-1 text-xs font-medium">
              {market.category}
            </span>
            <span className="text-xs text-neutral-500">
              Expires in ~3d 4h {/* dummy countdown */}
            </span>
          </div>
          <h1 className="text-2xl font-semibold">{market.title}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{market.description}</p>

          {/* Outcomes */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Outcomes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2">
              {market.outcomes.map((o) => (
                <button
                  key={o.label}
                  className="rounded-md border border-accentPurple/30 px-3 py-2 text-sm flex items-center justify-between bg-accentPurple/15 text-accentPurple hover:bg-accentPurple hover:text-white transition-colors"
                >
                  <span>{o.label}</span>
                  <span className="font-semibold">{o.percent}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">Volume</div>
              <div className="font-semibold">${(market.volumeUsd / 1_000_000).toFixed(1)}m</div>
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="text-xs text-neutral-500">Total bets</div>
              <div className="font-semibold">{market.totalBets.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Right: place bet */}
        <div className="md:col-span-1">
          <form action={handlePlaceBet} className="rounded-lg border border-neutral-800 p-4 bg-neutral-900 space-y-3">
            <h3 className="text-base font-semibold">Place Bet</h3>
            <label className="text-sm">Outcome</label>
            <select name="outcome" className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accentPurple/50">
              {market.outcomes.map((o) => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
            <label className="text-sm">Amount</label>
            <input name="amount" type="number" min="0" step="0.01" placeholder="0.00" className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accentPurple/50" />
            <button type="submit" className="w-full rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-4 py-2 text-sm font-medium">
              Place Bet
            </button>
            <p className="text-xs text-neutral-500">{/* TODO: integrate on-chain contract call via ethers on the action button */}</p>
          </form>
        </div>
      </div>
    </div>
  );
}


