"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ProfileHeader from "@/features/user/components/ProfileHeader";
import BetHistoryList, { Bet } from "@/features/user/components/BetHistoryList";
import UserPerformanceAnalytics from "@/features/user/components/UserPerformanceAnalytics";
import StatsCard from "@/features/user/components/StatsCard";
import PortfolioCard from "@/features/user/components/PortfolioCard";
import ReferralCard from "@/features/user/components/ReferralCard";
import ProfileSkeleton from "./ProfileSkeleton";
import { getMe, UserMeResponse, getAuthHeader } from "@/features/user/utils/userService";
import { getUserBets, UserBet } from "@/features/user/utils/betService";

import CreatedBetsList from "@/features/user/components/CreatedBetsList";

import api from "@/config/api";

/* -------------------------
   📊 Helper Types
-------------------------- */
export interface UserSummary {
  wallet: string;
  total_staked: number;
  total_claimed: number;
  total_profit: number;
  bets_count: number;
}

export interface Campaign {
  id: number;
  campaign_address: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  end_time: number;
  fee_bps: number;
  state: string;
  creation_stake: number;
  resolved: boolean;
  outcome_true: number | null; // 0 or 1 from DB
  totalTrue: number;
  totalFalse: number;
  totalInitialPot: number;
  volume: number;
  yes_odds: number;
  no_odds: number;
  percent_true: number;
  percent_false: number;
  category: string;
}

/* -------------------------
   📦 Helper Fetchers
-------------------------- */
async function getUserSummary(): Promise<UserSummary> {
  const headers = await getAuthHeader();
  const res = await api.get<UserSummary>("/bet/me/user-summary", { headers });
  return res.data;
}

async function getCampaignByAddress(campaignAddress: string): Promise<Campaign | null> {
  try {
    const res = await api.get<Campaign[]>("/factory/campaigns");  // <-- array
    const all = res.data;

    if (!Array.isArray(all)) {
      console.error("Unexpected /factory/campaigns shape:", all);
      return null;
    }

    return (
      all.find(
        (c) =>
          c.campaign_address.toLowerCase() === campaignAddress.toLowerCase()
      ) || null
    );
  } catch (err) {
    console.error("Failed to fetch /factory/campaigns:", err);
    return null;
  }
}

async function getMyCreatedBets() {
  const headers = await getAuthHeader();
  const res = await api.get<{ campaigns: Campaign[] }>("/bet/me/created-bets", { headers });
  return res.data.campaigns;
}

/* -------------------------
   🧠 Main Component
-------------------------- */
export default function ProfilePage() {
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [createdBets, setCreatedBets] = useState<Campaign[]>([]);
  const [marketTitles, setMarketTitles] = useState<Record<string, string>>({});
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [cash, setCash] = useState(0);
const [marketIds, setMarketIds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
const [points, setPoints] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);

        const [userData, summaryData, userBets, created] = await Promise.all([
          getMe(),
          getUserSummary(),
          getUserBets(),
          getMyCreatedBets(),
          
        ]);

        setUser(userData);
        setSummary(summaryData);
        setCreatedBets(created as Campaign[]);
        setPoints(userData.points);

        function determineBetStatus(b: UserBet, c: Campaign | null) {
    if (!c) return "Pending";
    if (c.state !== "resolved") return "Pending";
    if (c.outcome_true === null) return "Pending";

    const didWin =
        (c.outcome_true && b.side) ||
        (!c.outcome_true && !b.side);

    return didWin ? "Won" : "Lost";
}
        /* -----------------------
           Transform user bet history

           
        ------------------------ */
   const mappedBets: Bet[] = userBets.map((b: UserBet) => ({
    id: b.id,
    campaign_address: b.campaign_address,
    ticket_id: b.ticket_id,
    side: b.side,
    stake: b.stake,
    payout: b.payout,
    claimed: b.claimed,
    created_at: b.created_at,
    outcome: b.side ? "Yes" : "No",
    status: "Pending",
    pnl: 0
}));

const campaigns = await Promise.all(
    userBets.map((b: UserBet) => getCampaignByAddress(b.campaign_address))
);

let winCount = 0;
let lossCount = 0;

const updatedBets = mappedBets.map((bet, i) => {
  const campaign = campaigns[i];
  const status = determineBetStatus(userBets[i], campaign);

  let pnl = 0;
  let ticketValue = 0;
  const stake = bet.stake;

  if (campaign) {
    const tTrue = campaign.totalTrue ?? 0;
    const tFalse = campaign.totalFalse ?? 0;
    const tPot = campaign.totalInitialPot ?? 0;
    const fBps = campaign.fee_bps ?? 0;

    const pool = tTrue + tFalse + tPot;
    const fee = (pool * fBps) / 10000;
    const distributable = pool - fee;

    const isYes = bet.side === true;        // FIXED
    const outcome = campaign.outcome_true;  // number 0/1

    if (status === "Won") {
      const winnersTotal = outcome === 1 ? tTrue : tFalse;

      const payout = winnersTotal > 0
        ? (stake / winnersTotal) * distributable
        : stake;

      pnl = payout - stake;
      ticketValue = payout;

    } else if (status === "Lost") {
      pnl = -stake;
      ticketValue = 0;

    } else {
      // Pending → potential value
      const sideTotal = isYes ? tTrue : tFalse;
      ticketValue =
        sideTotal > 0 ? (stake / sideTotal) * distributable : stake;
      pnl = ticketValue - stake;
    }
  }
if (status === "Won") winCount++;
if (status === "Lost") lossCount++;
  return { ...bet, status, pnl, ticketValue,category: campaign?.symbol || "Unknown" };
});
// Build market title map
const titles: Record<string, string> = {};
const ids: Record<string, number> = {};

campaigns.forEach((c) => {
  if (c) {
    titles[c.campaign_address] = c.name || "Unknown Market";
    ids[c.campaign_address] = c.id;
  }
});

setMarketTitles(titles);
setMarketIds(ids);
        setBets(updatedBets as Bet[]);
        setWins(winCount);
        setLosses(lossCount);

const unclaimedWins = updatedBets
  .filter((b) => b.status === "Won" && !b.claimed)
  .reduce((sum, b) => sum + b.ticketValue, 0);

const pendingStake = updatedBets
  .filter((b) => b.status === "Pending")
  .reduce((sum, b) => sum + b.ticketValue, 0);

setPortfolioValue(unclaimedWins + pendingStake);

setCash(summaryData.total_claimed);

      } catch (err) {
        console.error("❌ Failed to load profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  /* -------------------------
     UI Rendering
  -------------------------- */
  if (loading) return <ProfileSkeleton />;

  if (error)
    return (
      <div className="container mx-auto p-6 text-red-500">
        <p>Error: {error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-accentPurple hover:underline"
        >
          Go home
        </button>
      </div>
    );

  if (!user || !summary)
    return (
      <div className="container mx-auto p-6 text-neutral-400">
        No user data available. Please log in.
      </div>
    );

  /* -------------------------
     ✅ Render Page
  -------------------------- */
  return (
    <div className="container mx-auto p-0 md:p-6 space-y-6">
      {/* Header gradient */}
      <div className="relative overflow-hidden">
        <div
          className="h-28 w-full"
          style={{
            background: "linear-gradient(135deg, #9b5de5 0%, #7a4edb 100%)",
          }}
        />
      </div>

      {/* Profile header */}
      <div className="px-6 -mt-10">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <ProfileHeader
            username={user.username}
            walletAddress={user.wallet_address}
          />
        </div>
      </div>

      {/* Portfolio + Stats */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1">
     <PortfolioCard
  portfolioValue={portfolioValue}
  cash={cash}
/>
        </div>

        <StatsCard label="Wins" value={wins} />
        <StatsCard label="Losses" value={losses} />

        <StatsCard
          label="PnL"
          value={`${summary.total_profit >= 0 ? "+" : ""}${summary.total_profit.toFixed(
            3
          )} USDC`}
        />
      </div>

      {/* Main content */}
      {/* Main content */}
<div className="px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="md:col-span-2 space-y-4">
    <UserPerformanceAnalytics bets={bets} />

  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
  <h3 className="text-base font-semibold mb-2">Recent Bets</h3>
 <BetHistoryList
  bets={bets}
  marketTitles={marketTitles}
  marketIds={marketIds}
/>
</div>
  </div>

  <div className="md:col-span-1 space-y-4">
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-base font-semibold mb-2">Notes</h3>
      <p className="text-sm text-neutral-400">
        Manage your prediction activity and track your performance over time.
      </p>
    </div>

      {/* Points Block */}
<div className="
  rounded-xl 
  border border-accentPurple/40 
  bg-neutral-900 
  p-5 
  relative 
  overflow-hidden
  shadow-[0_0_20px_rgba(155,93,229,0.25)]
">
  {/* Glowing gradient blur behind points */}
  <div className="
    absolute inset-0 
    bg-gradient-to-br from-accentPurple/30 via-[#8a4ae4]/20 to-transparent 
    blur-2xl opacity-60
  " />

  {/* Content */}
  <div className="relative z-10 text-center">
    <h3 className="text-base font-semibold mb-1 text-neutral-200">Your Points</h3>

    <div
      className="
        text-4xl font-bold 
        text-accentPurple 
        drop-shadow-[0_0_10px_rgba(155,93,229,0.8)]
        animate-pulse-slow
      "
    >
      {points}
    </div>

    <p className="text-xs text-neutral-500 mt-1">
      Earn points by creating markets, placing bets, and more.
    </p>
  </div>

</div>
<ReferralCard /> 
  </div>
</div>

{/* ✅ FULL WIDTH CREATED MARKETS */}
<div className="px-6">
  <CreatedBetsList campaigns={createdBets} />
</div>
    </div>
  );
}