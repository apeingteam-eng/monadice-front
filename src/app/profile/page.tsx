import ProfileHeader from "@/features/user/components/ProfileHeader";
import BetHistoryList from "@/features/user/components/BetHistoryList";
import WinLossChart from "@/features/user/components/WinLossChart";
import StatsCard from "@/features/user/components/StatsCard";
import PortfolioCard from "@/features/user/components/PortfolioCard";

export default function ProfilePage() {
  return (
    <div className="container mx-auto p-0 md:p-6 space-y-6">
      {/* Gradient masthead */}
      <div className="relative overflow-hidden">
        <div className="h-28 w-full" style={{ background: 'linear-gradient(135deg, #9b5de5 0%, #7a4edb 100%)' }} />
      </div>
      <div className="px-6 -mt-10">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <ProfileHeader />
        </div>
      </div>
      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <PortfolioCard />
        </div>
        <StatsCard label="Wins" value={0} />
        <StatsCard label="Losses" value={0} />
        <StatsCard label="PnL" value={0} />
      </div>
      <div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <WinLossChart />
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-base font-semibold mb-2">Recent Bets</h3>
            <BetHistoryList />
          </div>
        </div>
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-base font-semibold mb-2">Notes</h3>
            <p className="text-sm text-neutral-400">Manage your on-chain activity and track performance over time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}


