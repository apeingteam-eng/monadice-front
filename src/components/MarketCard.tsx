"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import BetCampaignABI from "@/lib/ethers/abi/BetCampaign.json";
import { CHAIN } from "@/config/network"; // <-- uses your network.ts

export type MarketSummary = {
  id: number;
  name: string;
  symbol: string;
  end_time: number;
  fee_bps: number;
  state: string;
  campaign_address: string;
};

// ---- Format numbers like $1.3k, $950k, $1.9m ----
function formatUsdShort(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatCountdown(endUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(endUnix - now, 0);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (diff <= 0) return "Ended";
  if (hours === 0) return `Ends in ${minutes}m`;
  return `Ends in ${hours}h ${minutes}m`;
}

type Props = {
  market: MarketSummary;
};

export default function MarketCard({ market }: Props) {
  const [yesPercent, setYesPercent] = useState(50);
  const [noPercent, setNoPercent] = useState(50);
  const [volume, setVolume] = useState(0);

  useEffect(() => {
    async function loadOnchainData() {
      try {
        // 🔥 Use the RPC from network.ts (Base Sepolia currently)
        const provider = new JsonRpcProvider(CHAIN.rpcUrl);

        const contract = new Contract(
          market.campaign_address,
          BetCampaignABI,
          provider
        );

        const [tTrueRaw, tFalseRaw, tPotRaw] = await Promise.all([
          contract.totalTrue(),
          contract.totalFalse(),
          contract.totalInitialPot(),
        ]);

        // Convert USDC (6 decimals) → human number
        const trueNum = Number(tTrueRaw) / 1e6;
        const falseNum = Number(tFalseRaw) / 1e6;
        const potNum = Number(tPotRaw) / 1e6;

        const totalVotes = trueNum + falseNum;

        if (totalVotes > 0) {
          setYesPercent(Math.round((trueNum / totalVotes) * 100));
          setNoPercent(Math.round((falseNum / totalVotes) * 100));
        } else {
          setYesPercent(50);
          setNoPercent(50);
        }

        // Total market volume
        setVolume(trueNum + falseNum + potNum);
      } catch (err) {
        console.error("Failed to load on-chain data:", err);
      }
    }

    loadOnchainData();
  }, [market.campaign_address]);

  // ---- Status label ----
  const now = Math.floor(Date.now() / 1000);
  const isEnded = market.end_time <= now;
  const isOpen = market.state === "open";

  let statusLabel = "Ended";
  let statusColor = "text-red-400";
  let dotColor = "bg-red-500";

  if (isOpen && !isEnded) {
    statusLabel = "Running";
    statusColor = "text-green-400";
    dotColor = "bg-green-500";
  } else if (isOpen && isEnded) {
    statusLabel = "Pending";
    statusColor = "text-yellow-400";
    dotColor = "bg-yellow-400";
  }

  return (
    <Link
      href={`/market/${market.id}`}
      className="group rounded-lg border border-neutral-800/80 bg-neutral-900 p-4 hover:shadow-md hover:border-accentPurple/40 transition-colors relative"
    >
      {/* Status */}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <span
          className={`inline-block w-2 h-2 rounded-full animate-pulse ${dotColor}`}
        ></span>
        <span className={`text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Volume */}
      <div className="mb-3 text-sm text-neutral-500">
        {formatUsdShort(volume)} Vol.
      </div>

      {/* Symbol */}
      {market.symbol && (
        <div className="mb-2 inline-flex items-center rounded-full bg-accentPurple/15 text-accentPurple px-2.5 py-0.5 text-xs font-medium">
          {market.symbol}
        </div>
      )}

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold group-hover:text-accentPurple">
        {market.name}
      </h3>

      {/* Countdown */}
      <p className="text-xs text-neutral-500 mb-3">
        {formatCountdown(market.end_time)}
      </p>

      {/* YES / NO */}
<div className="grid grid-cols-2 gap-2">

  {/* YES */}
  <div
    className="
      flex items-center justify-between rounded-md border px-3 py-2 text-sm 
      border border-neutral-700
      bg-neutral-950
      hover:bg-green-900/20
      transition-colors
    "
  >
    <span className="white-300">Yes</span>
    <span className="font-medium white-300">{yesPercent}%</span>
  </div>

  {/* NO */}
  <div
    className="
    border border-neutral-700
      flex items-center justify-between rounded-md border px-3 py-2 text-sm 
      bg-neutral-950
      hover:bg-red-900/20
      transition-colors
    "
  >
    <span className="white-300">No</span>
    <span className="font-medium white-300">{noPercent}%</span>
  </div>

</div>
    </Link>
  );
}