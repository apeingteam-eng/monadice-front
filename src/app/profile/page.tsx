"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ProfileHeader from "@/features/user/components/ProfileHeader";
import BetHistoryList, { Bet } from "@/features/user/components/BetHistoryList";
import WinLossChart from "@/features/user/components/WinLossChart";
import StatsCard from "@/features/user/components/StatsCard";
import PortfolioCard from "@/features/user/components/PortfolioCard";

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
  name: string;
  symbol: string;
  campaign_address: string;
  outcome_true: boolean | null;
  state: string;
  end_time: number;
  fee_bps: number;
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

  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        /* -----------------------
           Transform user bet history
        ------------------------ */
        const mappedBets: Bet[] = userBets.map((b: UserBet) => ({
          id: b.id,
          campaign_address: b.campaign_address,
          outcome: b.side ? "Yes" : "No",
          stake: b.stake,
          status: "Pending" as const,
          created_at: b.created_at,
        }));

        const campaigns = await Promise.all(
          userBets.map((b: UserBet) => getCampaignByAddress(b.campaign_address))
        );

        let winCount = 0;
        let lossCount = 0;

        const updatedBets = mappedBets.map((bet, i) => {
          const campaign = campaigns[i];
          if (!campaign || campaign.outcome_true === null) return bet;

          const didWin =
            (campaign.outcome_true && userBets[i].side) ||
            (!campaign.outcome_true && !userBets[i].side);

          if (didWin) {
            winCount++;
            return { ...bet, status: "Won" as const };
          } else {
            lossCount++;
            return { ...bet, status: "Lost" as const };
          }
        });

        setBets(updatedBets as Bet[]);
        setWins(winCount);
        setLosses(lossCount);
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
  if (loading)
    return (
      <div className="container mx-auto p-6 text-neutral-400">
        Loading profile…
      </div>
    );

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
            totalStaked={summary.total_staked}
            totalClaimed={summary.total_claimed}
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
    <WinLossChart wins={wins} losses={losses} />

    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-base font-semibold mb-2">Recent Bets</h3>
      <BetHistoryList bets={bets} />
    </div>
  </div>

  <div className="md:col-span-1 space-y-4">
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-base font-semibold mb-2">Notes</h3>
      <p className="text-sm text-neutral-400">
        Manage your on-chain activity and track your performance over time.
      </p>
    </div>
  </div>
</div>

{/* ✅ FULL WIDTH CREATED MARKETS */}
<div className="px-6">
  <CreatedBetsList campaigns={createdBets} />
</div>
    </div>
  );
}