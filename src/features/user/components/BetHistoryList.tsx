"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import api from "@/config/api";

/* --------------------------------------------------------------
   Types
-------------------------------------------------------------- */

export type Bet = {
  id: number;
  campaign_address: string;
  ticket_id: number;
  side: boolean;
  stake: number;
  payout: number | null;
  claimed: boolean;
  created_at: string;

  // Derived
  status: "Pending" | "Won" | "Lost";
  outcome: "Yes" | "No";
  pnl: number;
};

type BetHistoryListProps = {
  bets: Bet[];
  marketTitles: Record<string, string>;
};

type GroupedBets = Record<string, Bet[]>;

type CampaignResp = {
  id: number;
  campaign_address: string;
  name: string;
  resolved: boolean;
  outcome_true: boolean | null;
  state: string; // open | resolved
};

/* --------------------------------------------------------------
   Status badge
-------------------------------------------------------------- */
function StatusBadge({ status }: { status: Bet["status"] }) {
  const cls =
    status === "Won"
      ? "bg-green-500/15 text-green-400"
      : status === "Lost"
      ? "bg-red-500/15 text-red-400"
      : "bg-yellow-500/15 text-yellow-400";

  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{status}</span>;
}

/* --------------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------------- */
export default function BetHistoryList({
  bets,
  marketTitles = {},
}: BetHistoryListProps) {
  const [updatedBets, setUpdatedBets] = useState<Bet[]>([]);

  useEffect(() => {
    async function enrichBets() {
      const results: Bet[] = [];

      for (const bet of bets) {
        let status: Bet["status"] = "Pending";

        try {
          const res = await api.get<CampaignResp[]>(
            "/factory/campaigns"
          );

          const all = res.data;
          const campaign = all.find(
            (c) =>
              c.campaign_address.toLowerCase() ===
              bet.campaign_address.toLowerCase()
          );

          if (campaign && campaign.state === "resolved") {
            if (campaign.outcome_true !== null) {
              const didWin =
                (campaign.outcome_true && bet.side) ||
                (!campaign.outcome_true && !bet.side);

              status = didWin ? "Won" : "Lost";
            }
          }
        } catch (e) {
          console.error("Failed to load campaign info", e);
        }

        results.push({
          ...bet,
          status,
        });
      }

      setUpdatedBets(results);
    }

    enrichBets();
  }, [bets]);

  /* Group */
  const grouped: GroupedBets = updatedBets.reduce((acc, b) => {
    if (!acc[b.campaign_address]) acc[b.campaign_address] = [];
    acc[b.campaign_address].push(b);
    return acc;
  }, {} as GroupedBets);

  const campaigns = Object.entries(grouped);

  if (campaigns.length === 0) {
    return (
      <p className="text-neutral-400 mt-4">
        You have no recent betting activity.
      </p>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {campaigns.map(([address, betList]) => (
        <CampaignAccordion
          key={address}
          address={address}
          bets={betList}
          title={marketTitles[address] || "Unknown Market"}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------
   Accordion Section
-------------------------------------------------------------- */
function CampaignAccordion({
  address,
  bets,
  title,
}: {
  address: string;
  bets: Bet[];
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 hover:bg-neutral-900"
      >
        <div className="flex flex-col text-left">
          <span className="font-medium text-white">{title}</span>
          <span className="text-xs text-neutral-400">
            Market {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>

        <span className="text-neutral-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="divide-y divide-neutral-800">
          {bets.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between px-4 py-3"
            >
              {/* LEFT */}
              <div>
                <Link
                  href={`/market/${address}`}
                  className="text-neutral-300 hover:underline text-sm"
                >
                  Ticket #{b.ticket_id}
                </Link>

                <p className="text-sm text-neutral-300">
                  Outcome: {b.outcome}
                </p>

                <p className="text-sm text-neutral-300">
                  Stake:{" "}
                  <span className="font-medium">
                    ${b.stake.toFixed(2)}
                  </span>
                </p>

                {b.claimed && (
                  <p
                    className={`text-sm font-medium ${
                      b.pnl >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {b.pnl >= 0
                      ? `Cashed Out: +${b.pnl.toFixed(3)} USDC`
                      : `Lost: -${Math.abs(b.stake).toFixed(3)} USDC`}
                  </p>
                )}
              </div>

              {/* RIGHT */}
              <div className="text-right">
                <StatusBadge status={b.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}