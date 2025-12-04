"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MarketSkeleton from "./MarketSkeleton";
import { useToast } from "@/components/toast/ToastContext";
import PlaceBetForm from "@/components/PlaceBetForm";
import ClaimView from "@/components/market/ClaimView";
import TicketGallery from "@/components/market/TicketGallery";

// Icons (Using inline SVGs to avoid dependency issues, or lucide-react if you have it)
const IconArrowLeft = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>;
const IconClock = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconWallet = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconChart = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;
const IconTrophy = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;

/* -------------------------------------------------------------------------- */
/* Types / Helpers                               */
/* -------------------------------------------------------------------------- */

type Campaign = {
  id: number;
  name: string;
  symbol: string;
  creator_wallet: string;
  campaign_address: string;
  end_time: number;
  state: string;
  fee_bps: number;
  creation_stake: number;
  tx_hash: string;
  deployed_at: string;
  outcome_true: number; // 1 for True, 0 for False (if resolved)
  
  // Stats
  totalTrue: number;
  totalFalse: number;
  totalInitialPot: number;
  volume: number;
  yes_odds: number;
  no_odds: number;
  percent_true: number;
  percent_false: number;
  resolved: boolean;
};

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(endUnix - now, 0);

  const hours = Math.floor(diff / 3600);
  const days = Math.floor(hours / 24);

  if (diff <= 0) return "Expired";
  if (days > 0) return `${days}d ${hours % 24}h left`;
  return `${hours}h ${Math.floor((diff % 3600) / 60)}m left`;
}

function formatUsdShort(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/* -------------------------------------------------------------------------- */
/* Main Component                               */
/* -------------------------------------------------------------------------- */

export default function MarketPage() {
  const { marketId } = useParams();
  const router = useRouter();
  const toast = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats State
  const [yesPercent, setYesPercent] = useState(50);
  const [noPercent, setNoPercent] = useState(50);
  const [oddsYes, setOddsYes] = useState("1.00");
  const [oddsNo, setOddsNo] = useState("1.00");
  const [volume, setVolume] = useState(0);

  /* -------------------------------------------------------------------------- */
  /* 1. Load campaign from backend (/factory/campaign)           */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    async function loadCampaign() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/factory/campaign/${marketId}`
        );

        if (!res.ok) {
          toast.error("Unable to load market from backend.");
          return;
        }

        const data = await res.json();
        setCampaign(data);
      } catch (err) {
        console.error("Failed to fetch campaign:", err);
        toast.error("Failed to connect to backend.");
      } finally {
        setLoading(false);
      }
    }

    loadCampaign();
  }, [marketId, toast]);


  /* Use backend-calculated values directly */
  useEffect(() => {
    if (!campaign) return;

    setYesPercent(campaign.percent_true);
    setNoPercent(campaign.percent_false);
    setVolume(campaign.volume);
    setOddsYes(campaign.yes_odds.toFixed(2));
    setOddsNo(campaign.no_odds.toFixed(2));
  }, [campaign]);

  /* -------------------------------------------------------------------------- */
  /* Rendering                                 */
  /* -------------------------------------------------------------------------- */

  if (loading) return <MarketSkeleton />;

  if (!campaign) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-xl font-semibold text-neutral-400">Market not found</h1>
        <button onClick={() => router.back()} className="mt-4 text-accentPurple hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  /* ------------------------- Market state display --------------------------- */

  const isRunning = campaign.state === "open" && campaign.resolved === false;
  const isPending = campaign.state === "open" && campaign.resolved === true;
  // const isEnded = campaign.state === "resolved"; // (Unused var, but logic exists)

  let statusLabel = "Ended";
  let statusBadgeClass = "bg-neutral-800 text-neutral-400 border-neutral-700";
  let dotColor = "bg-red-500";

  if (isRunning) {
    statusLabel = "Active";
    statusBadgeClass = "bg-green-500/10 text-green-400 border-green-500/20";
    dotColor = "bg-green-400";
  } else if (isPending) {
    statusLabel = "Pending Resolution";
    statusBadgeClass = "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
    dotColor = "bg-yellow-400";
  }

  const countdown = formatCountdown(campaign.end_time);

  /* -------------------------------------------------------------------------- */
  /* JSX                                      */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen pb-20">
      
      {/* 1. Breadcrumb / Navigation Bar */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 md:px-6 flex items-center gap-2 text-sm text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
            <IconArrowLeft /> Back to Markets
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="uppercase tracking-wider font-medium text-neutral-500">
            {campaign.symbol}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ======================= LEFT PANEL (Content) ======================= */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* --- HEADER SECTION --- */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Badge */}
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                  {statusLabel}
                </div>
                
                {/* Countdown Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                   <IconClock />
                   {countdown}
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                {campaign.name}
              </h1>

              {/* Creator Info */}
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <IconWallet />
                <span>Created by</span>
                <span className="font-mono text-accentPurple bg-accentPurple/10 px-2 py-0.5 rounded text-xs">
                  {campaign.creator_wallet.slice(0, 6)}...{campaign.creator_wallet.slice(-4)}
                </span>
              </div>
            </div>

            {/* --- OUTCOME VISUALIZATION --- */}
            <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl">
              <h3 className="text-neutral-400 text-sm font-medium mb-4 flex items-center gap-2">
                <IconChart /> Current Market Probability
              </h3>
              
              <div className="space-y-6">
                {/* YES BAR */}
                <div className="relative group">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xl font-bold text-green-400">Yes</span>
                    <span className="text-2xl font-bold text-white">{yesPercent}%</span>
                  </div>
                  <div className="h-4 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-1000 ease-out"
                      style={{ width: `${yesPercent}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-neutral-500">
                     Odds: <span className="text-green-400 font-mono">{oddsYes}x</span>
                  </div>
                </div>

                {/* NO BAR */}
                <div className="relative group">
                   <div className="flex justify-between items-end mb-2">
                    <span className="text-xl font-bold text-red-400">No</span>
                    <span className="text-2xl font-bold text-white">{noPercent}%</span>
                  </div>
                  <div className="h-4 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 ease-out"
                      style={{ width: `${noPercent}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-neutral-500">
                     Odds: <span className="text-red-400 font-mono">{oddsNo}x</span>
                  </div>
                </div>
              </div>

              {/* Resolution Result (If Resolved) */}
              {campaign.resolved && (
                <div className="mt-8 p-4 rounded-xl bg-black/40 border border-neutral-700 flex items-center justify-between">
                  <span className="text-neutral-300 font-medium flex items-center gap-2">
                    <IconTrophy /> Final Outcome
                  </span>
                  {campaign.outcome_true === 1 ? (
                    <span className="text-green-400 font-bold text-lg tracking-wide">YES WON</span>
                  ) : (
                    <span className="text-red-400 font-bold text-lg tracking-wide">NO WON</span>
                  )}
                </div>
              )}
            </div>

            {/* --- STATS GRID --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Volume" value={formatUsdShort(volume)} sub="Total Traded" />
              <StatCard label="Initial Pot" value={`${campaign.totalInitialPot} USDC`} sub="Seed Liquidity" />
              <StatCard label="Creator Fee" value={`${campaign.fee_bps / 100}%`} sub="Per Trade" />
              <StatCard label="Category" value={campaign.symbol} sub="Market Tag" />
            </div>

            {/* --- TICKET GALLERY --- */}
            <div className="pt-8 border-t border-neutral-800">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">Recent Activity</h3>
                <p className="text-sm text-neutral-500">Live trades and tickets for this market</p>
              </div>
              <TicketGallery
                campaignAddress={campaign.campaign_address as `0x${string}`}
                endTime={campaign.end_time}
                state={
                  campaign.state === "open" ? 0 :
                  campaign.state === "resolved" ? 1 :
                  campaign.state === "cancelled" ? 2 : 0
                }
              />
            </div>
          </div>

          {/* ======================= RIGHT PANEL (Sticky Action) ======================= */}
          <div className="lg:col-span-4 relative">
             <div className="sticky top-24 space-y-6">
                
                {/* Action Card */}
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-1 shadow-2xl shadow-accentPurple/5">
                  <div className="bg-[#0A0A0A] rounded-xl p-5 border border-neutral-800/50">
                    <h2 className="text-lg font-bold text-white mb-4 border-b border-neutral-800 pb-3">
                      {isRunning ? "Place your Bet" : "Market Actions"}
                    </h2>
                    
                    {isRunning ? (
                      <PlaceBetForm
                        campaignId={campaign.id}
                        campaignAddress={campaign.campaign_address}
                        bettingClosed={false}
                      />
                    ) : (
                      <ClaimView
                        campaignAddress={campaign.campaign_address as `0x${string}`}
                        endTime={campaign.end_time}
                      />
                    )}
                  </div>
                </div>

                {/* Disclaimer / Info */}
                <div className="p-4 rounded-xl bg-accentPurple/5 border border-accentPurple/10 text-xs text-neutral-400 leading-relaxed">
                  <strong className="text-accentPurple block mb-1">How it works</strong>
                  Buy &quot;Yes&quot; or &quot;No&quot; tickets. If the outcome matches your ticket, you win a share of the opposing pool + your initial stake back.
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper Component                                */
/* -------------------------------------------------------------------------- */

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-neutral-600 mt-1">{sub}</div>
    </div>
  );
}