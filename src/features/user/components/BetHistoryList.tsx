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
  category?: string;

  // Derived
  status: "Pending" | "Won" | "Lost";
  outcome: "Yes" | "No";
  pnl: number;
};

type BetHistoryListProps = {
  bets: Bet[];
  marketTitles: Record<string, string>;
  marketIds: Record<string, number>;
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
      ? "bg-green-500/20 text-green-300 border border-green-500/30"
      : status === "Lost"
      ? "bg-red-500/20 text-red-300 border border-red-500/30"
      : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";

  return <span className={`px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-sm ${cls}`}>{status}</span>;
}

/* --------------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------------- */
export default function BetHistoryList({
  bets,
  marketTitles = {},
  marketIds,   
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
          marketIds={marketIds}
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
  marketIds,
}: {
  address: string;
  bets: Bet[];
  title: string;
  marketIds: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-xl shadow-[0_0_25px_rgba(155,93,229,0.15)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(155,93,229,0.35)] hover:rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-4 hover:bg-neutral-900/80 transition-all duration-300 rounded-xl"
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
        <div className="divide-y divide-neutral-800 bg-neutral-900/40 p-3 rounded-xl">
          {bets.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between px-4 py-3"
            >
              {/* LEFT */}
              <div>
                <Link
                  href={`/market/${marketIds[address]}`}
                  className="text-neutral-200 hover:text-accentPurple transition text-sm font-medium"
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