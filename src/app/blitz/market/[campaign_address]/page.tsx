"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { usePublicClient } from "wagmi";
import { formatUnits, Contract } from "ethers"; // Logic validation only, mostly usage of Wagmi or generic logic

import BlitzJoinForm from "../BlitzJoinForm";
import BlitzClaimView from "../BlitzClaimView";
import BlitzAdminPanel from "../BlitzAdminPanel";
import BlitzTicketGallery from "../BlitzTicketGallery";
import { useToast } from "@/components/toast/ToastContext";
import BlitzBetCampaignABI from "@/lib/ethers/abi/BlitzBetCampaign.json";
import { CHAIN } from "@/config/network";
import { useAccount } from "wagmi";

// Icons
const IconArrowLeft = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>;
const IconClock = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const IconWallet = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>;
const IconChart = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>;
const IconLock = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;

/* ------------------------------------------------------------
   TYPES
------------------------------------------------------------ */
type BlitzMarketDetail = {
  id: number;
  campaign_address: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  choices: string[];
  outcome_count: number;
  end_time: number;
  state: "open" | "resolved" | "canceled";
  bet_token: string;
  permissioned: boolean;
  winning_outcome: number | null;
  whitelist: string[] | null;
  // Optional stats if API adds them later
  total_volume?: number;
};

/* ------------------------------------------------------------
   HELPER: Stat Card
------------------------------------------------------------ */
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-neutral-600 mt-1">{sub}</div>
    </div>
  );
}

function truncateAddress(addr: string) {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endUnix - now;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h ${Math.floor((diff % 3600) / 60)}m left`;
}

/* ------------------------------------------------------------
   PAGE COMPONENT
------------------------------------------------------------ */
export default function BlitzMarketPage() {
  const { campaign_address } = useParams(); // Note: check nextjs routing if folder is [campaign_address]
  const router = useRouter();
  const toast = useToast();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const [market, setMarket] = useState<BlitzMarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Chain Data for visualization
  const [poolStats, setPoolStats] = useState<{ [key: number]: number }>({});
  const [totalPool, setTotalPool] = useState<number>(0);

  // Address check
  const addressStr = Array.isArray(campaign_address) ? campaign_address[0] : campaign_address;

  /* ---------------- LOAD MARKET API ---------------- */
  useEffect(() => {
    if (!addressStr) return;

    async function loadmarket() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/by-address/${addressStr}`);
        if (!res.ok) throw new Error("Failed to load market");

        const data = await res.json();
        // Expect { status: "success", market: { ... } }
        if (data.status === "success" && data.market) {
          setMarket(data.market);
        } else {
          // Fallback if structure differs
          setMarket(data);
        }
      } catch (err) {
        console.error(err);
        toast.error("Could not load market details.");
      } finally {
        setLoading(false);
      }
    }
    loadmarket();
  }, [addressStr, toast]);

  /* ---------------- LOAD CHAIN STATS ---------------- */
  useEffect(() => {
    if (!market || !publicClient || !addressStr) return;

    async function fetchStats() {
      try {
        // Loop through outcomes to get total staked
        const count = market.outcome_count;
        const stats: { [key: number]: number } = {};
        let total = 0;

        // Parallel fetch
        const promises = [];
        for (let i = 0; i < count; i++) {
          promises.push(
            publicClient.readContract({
              address: addressStr as `0x${string}`,
              abi: BlitzBetCampaignABI,
              functionName: "totalStakedPerOutcome",
              args: [i]
            })
          );
        }

        const results = await Promise.all(promises);

        results.forEach((val, i) => {
          const formatted = Number(formatUnits(val as bigint, market.bet_token === "0x0000000000000000000000000000000000000000" ? 18 : 6 // rough guess, ideally read decimals
          ));
          stats[i] = formatted;
          total += formatted;
        });

        setPoolStats(stats);
        setTotalPool(total);

      } catch (e) {
        console.error("Chain stats error", e);
      }
    }

    fetchStats();
  }, [market, publicClient, addressStr]);


  /* ---------------- RENDER ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accentPurple border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-neutral-400">Market not found</h1>
        <Link href="/blitz" className="text-accentPurple hover:underline">Back to Blitz</Link>
      </div>
    );
  }

  const isEnded = market.end_time <= Math.floor(Date.now() / 1000);
  const isPrivate = market.permissioned;

  // Status Logic
  let statusLabel = "Ended";
  let statusClass = "bg-neutral-800 text-neutral-400 border-neutral-700";
  let dotColor = "bg-neutral-500";

  if (market.state === "open" && !market.winning_outcome && !isEnded) {
    statusLabel = "Active";
    statusClass = "bg-green-500/10 text-green-400 border border-green-500/20";
    dotColor = "bg-green-500";
  } else if (market.state === "open" && market.winning_outcome) {
    statusLabel = "Pending Resolution";
    statusClass = "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
    dotColor = "bg-yellow-500";
  }

  // --- CREATOR CHECK ---
  const isCreator = address && market.creator_wallet && address.toLowerCase() === market.creator_wallet.toLowerCase();

  return (
    <div className="min-h-screen pb-20">

      {/* NAV */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 md:px-6 flex items-center gap-2 text-sm text-neutral-400">
          <Link href="/blitz" className="hover:text-white transition-colors flex items-center gap-1">
            <IconArrowLeft /> Back to Blitz
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="uppercase tracking-wider font-medium text-neutral-500">
            {market.symbol}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT PANEL */}
          <div className="lg:col-span-8 space-y-8">

            {/* Header */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                  {statusLabel}
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                  <IconClock />
                  {formatCountdown(market.end_time)}
                </div>

                {isPrivate && (
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <IconLock /> Private
                  </div>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                {market.name}
              </h1>

              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <IconWallet />
                <span>Created by</span>
                <span className="font-mono text-accentPurple bg-accentPurple/10 px-2 py-0.5 rounded text-xs">
                  {truncateAddress(market.creator_wallet)}
                </span>
              </div>
            </div>

            {/* CHART / BARS */}
            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl">
              <h3 className="text-neutral-400 text-sm font-medium mb-4 flex items-center gap-2">
                <IconChart /> Market Distribution
              </h3>

              <div className="space-y-6">
                {market.choices.map((choice, idx) => {
                  const amount = poolStats[idx] || 0;
                  const percent = totalPool > 0 ? (amount / totalPool) * 100 : 0;
                  // Color Rotation or just nice gradients
                  const colors = [
                    "from-blue-600 to-blue-400",
                    "from-purple-600 to-purple-400",
                    "from-green-600 to-green-400",
                    "from-orange-600 to-orange-400",
                    "from-red-600 to-red-400",
                  ];
                  const grad = colors[idx % colors.length];

                  return (
                    <div key={idx} className="relative group">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-lg font-bold text-neutral-200">{choice}</span>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-white">{percent.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-4 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${grad} transition-all duration-1000 ease-out`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right text-xs text-neutral-500 font-mono">
                        {amount.toFixed(2)} pooled
                      </div>
                    </div>
                  );
                })}

                {totalPool === 0 && (
                  <div className="text-center py-8 text-neutral-600 text-sm">
                    No bets placed yet. Be the first!
                  </div>
                )}
              </div>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Pool" value={`${totalPool.toFixed(2)}`} sub={market.bet_token === "0x0000000000000000000000000000000000000000" ? "MON" : "Tokens"} />
              <StatCard label="Outcomes" value={market.outcome_count.toString()} sub="Possible Results" />
              <StatCard label="Type" value={isPrivate ? "Private" : "Public"} sub="Access Level" />
              <StatCard label="Status" value={market.state.toUpperCase()} sub="Market State" />
            </div>

          </div>


          {/* RIGHT PANEL */}
          <div className="lg:col-span-4 relative">
            <div className="sticky top-24 space-y-6">


              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-1 shadow-2xl shadow-accentPurple/5">
                <div className="bg-[#0A0A0A] rounded-xl p-5 border border-neutral-800/50">
                  <h2 className="text-lg font-bold text-white mb-4 border-b border-neutral-800 pb-3">
                    {statusLabel === "Active" ? "Place your Bet" : "Market Actions"}
                  </h2>


                  {statusLabel === "Active" ? (
                    <BlitzJoinForm
                      campaignAddress={addressStr}
                      betToken={market.bet_token}
                      outcomes={market.choices}
                      bettingClosed={false}
                      permissioned={isPrivate}
                      onJoinSuccess={() => setRefreshKey(prev => prev + 1)}
                    />
                  ) : (
                    <BlitzClaimView
                      campaignAddress={addressStr}
                      winningOutcome={market.winning_outcome}
                      outcomes={market.choices}
                      betToken={market.bet_token}
                    />
                  )}
                </div>
              </div>

              {/* ADMIN PANEL */}
              {isCreator && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <BlitzAdminPanel
                    campaignAddress={addressStr}
                    outcomes={market.choices}
                    permissioned={isPrivate}
                  />
                </div>
              )}

              <div className="p-4 rounded-xl bg-accentPurple/5 border border-accentPurple/10 text-xs text-neutral-400 leading-relaxed">
                <strong className="text-accentPurple block mb-1">Blitz Rules</strong>
                Select your predicted outcome. Winners share the losing pool proportionally. If Private, you must be whitelisted.
              </div>
            </div>
          </div>

        </div>

        {/* NEW: TICKET GALLERY */}
        <BlitzTicketGallery
          currentCampaignAddress={addressStr}
          outcomes={market.choices}
          winningOutcome={market.winning_outcome}
          refreshTrigger={refreshKey}
        />
      </div>
    </div>
  );
}