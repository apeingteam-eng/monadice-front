"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

import api from "@/config/api";
import { getAuthHeader } from "@/features/user/utils/userService";


import RouletteBanner from "./components/RouletteBanner";
import RouletteTable from "./components/RouletteTable";
import TicketTray from "./components/TicketTray";
import { 
  RouletteStage, 
  PlacedBet, 
  CampaignGroup,
} from "./types";



/* ==============================
   PAGE
============================== */

export default function TicketCasinoPage() {
  const { isConnected } = useAccount();

  // API Driven States
  const [stage, setStage] = useState<RouletteStage>(RouletteStage.PREPARATION);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [roundId, setRoundId] = useState<number | null>(null);
  const [stageInfo, setStageInfo] = useState<any>(null);
  const [showInfo, setShowInfo] = useState(false);

  // UI States
  const [campaignGroups, setCampaignGroups] = useState<CampaignGroup[]>([]);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Refs for smart polling
  const prevStageIdRef = useRef<number | null>(null);

  /* -----------------------------------------
     FORMAT TIMER (seconds -> MM:SS)
  ------------------------------------------ */
  const formatTime = (seconds: number | null) => {
    if (seconds === null || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  /* -----------------------------------------
     FETCH STAGE INFORMATION
     Called only when stage_id changes
  ------------------------------------------ */
  const fetchDetailedInfo = async (stage_id: number) => {
    try {
      const infoRes = await api.get("/roulette/getStageInformation");
const data = (infoRes.data as any).response; // Cast here to resolve 'unknown'
setStageInfo(data);

      // If we transitioned into Stage 3 (Result), update the winning number
      if (stage_id === 3 && data?.round?.resultNumber !== undefined) {
        setResultNumber(data.round.resultNumber);
      }
    } catch (err) {
      console.error("Failed to fetch detailed stage information:", err);
    }
  };

  /* -----------------------------------------
     API POLLING LOGIC (Every 2 seconds)
  ------------------------------------------ */
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // 1. Get Current Stage Summary
const stageRes = await api.get("/roulette/getStage");
// Cast to 'any' or a specific interface to access properties
const { stage_id, round_id, seconds_remaining } = stageRes.data as any;

setRoundId(round_id);
        // Update basic stage UI
        if (stage_id === 4) {
          setStage(RouletteStage.PREPARATION);
          setTimeLeft(seconds_remaining);
          // If we just entered Prep stage from a previous result, reset data
          if (prevStageIdRef.current !== 4) {
            setResultNumber(null);
            setStageInfo(null);
          }
        } else if (stage_id === 1 || stage_id === 2) {
          setStage(RouletteStage.RESOLUTION);
          setTimeLeft(null);
        } else if (stage_id === 3) {
          setStage(RouletteStage.RESULT);
          setTimeLeft(null);
        }

        // 2. SMART FETCH: Check if stage changed
        // This ensures getStageInformation is called on first load AND every transition
        if (stage_id !== prevStageIdRef.current) {
          await fetchDetailedInfo(stage_id);
          prevStageIdRef.current = stage_id;
        }

      } catch (err) {
        console.error("Failed to poll roulette status:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  /* -----------------------------------------
     LOAD USER TICKETS + CAMPAIGNS
  ------------------------------------------ */
  useEffect(() => {
    if (!isConnected) {
      setCampaignGroups([]);
      return;
    }
    loadTickets();
  }, [isConnected]);

  async function loadTickets() {
    try {
      setLoadingTickets(true);
      const headers = await getAuthHeader();
      const res = await api.get("/auth/me/getbetsforcasino", { headers });
// Access data with casting
const betsData = res.data as any; 
const bets = Array.isArray(betsData?.bets) ? betsData.bets : [];

      const grouped = new Map<string, CampaignGroup>();
      for (const b of bets) {
        if (typeof b.ticket_id !== "number") continue;
        const campaignAddress = b.campaign_address;
        if (!grouped.has(campaignAddress)) {
          grouped.set(campaignAddress, {
            campaignId: b.campaign_id,
            campaignAddress: campaignAddress,
            name: b.campaign_name,
            state: "open",
            endTime: 0,
            odds: { yes: 0, no: 0 },
            tickets: [],
          });
        }
        grouped.get(campaignAddress)!.tickets.push({
  uid: `${b.campaign_address}:${b.ticket_id}`,
  ticketId: b.ticket_id,
  campaignAddress: b.campaign_address,
  campaignName: b.campaign_name, // <--- ADD THIS LINE HERE
  side: Boolean(b.side),
  stake: Number(b.stake ?? 0),
  imageUrl: `/monadice${Math.min(Math.abs(b.ticket_id) + 1, 6)}.png`,
  payout: b.payout,
});
      }
      setCampaignGroups(Array.from(grouped.values()));
    } catch (err: any) {
      console.error("Failed to load tickets:", err);
      setCampaignGroups([]);
    } finally {
      setLoadingTickets(false);
    }
  }

  /* -----------------------------------------
     BETTING HELPERS
  ------------------------------------------ */
 /* -----------------------------------------
   BETTING HELPERS (page.tsx)
------------------------------------------ */

// Update this to keep the group even if tickets are 0
function removeTicketFromTray(ticketUid: string) {
  setCampaignGroups((prev) =>
    prev.map((c) => ({
      ...c,
      // Remove the ticket, but DO NOT filter out the group itself
      tickets: c.tickets.filter((t) => t.uid !== ticketUid),
    }))
  );
}

function handleClearAll(placed: PlacedBet[]) {
  setCampaignGroups((prev) => {
    // Create a map for quick lookup
    const newGroups = [...prev];

    for (const b of placed) {
      const groupIndex = newGroups.findIndex(g => g.campaignAddress === b.campaignAddress);
      
      // If the group exists (it will, because we no longer filter them out above)
      if (groupIndex !== -1) {
        const exists = newGroups[groupIndex].tickets.some(t => t.uid === b.ticketUid);
        if (!exists) {
  newGroups[groupIndex].tickets.push({
    uid: b.ticketUid,
    ticketId: b.ticketId,
    campaignAddress: b.campaignAddress,
    campaignName: b.campaignName, // <--- ADD THIS LINE
    side: b.side,
    stake: b.stake,
    imageUrl: `/monadice${Math.min(Math.abs(b.ticketId) + 1, 6)}.png`,
    payout: null,
  });
}
      }
    }
    return newGroups;
  });
  setPlacedBets([]);
}
  return (
    <div className="w-full py-6 min-h-screen">
      <RouletteBanner 
        stage={stage} 
        resultNumber={resultNumber} 
        timer={formatTime(timeLeft)} 
      />

      <div className="max-w-[1800px] mx-auto px-6 mt-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* LEFT — ROULETTE TABLE */}
          <div className="flex-1 w-full min-w-0">
            <RouletteTable
              placed={placedBets}
              setPlaced={setPlacedBets}
              removeTicketFromTray={removeTicketFromTray}
              onClearAll={handleClearAll}
              disabled={stage !== RouletteStage.PREPARATION}
            />
          </div>

          {/* RIGHT — TICKET TRAY SIDEBAR */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="sticky top-24 flex flex-col gap-4" style={{ maxHeight: 'calc(100vh - 40px)' }}>
              
              {/* TICKETS CONTAINER */}
              <div className="rounded-2xl border border-white/5 bg-[#0A0A0A]/90 backdrop-blur-xl shadow-2xl flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage === RouletteStage.PREPARATION ? 'bg-accentPurple animate-pulse' : 'bg-white/20'}`} />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      {stage === RouletteStage.PREPARATION ? 'Your Tickets' : 'Bets Closed'}
                    </h2>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  {loadingTickets && (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin h-6 w-6 border-2 border-accentPurple border-t-transparent rounded-full" />
                    </div>
                  )}
                  {campaignGroups.map((campaign) => (
  <div key={campaign.campaignAddress} className="flex flex-col gap-3">
    <span className="text-xs font-bold text-white truncate px-1">{campaign.name}</span>
    <div className="bg-black/20 rounded-xl border border-white/5 p-2">
      <TicketTray
        tickets={campaign.tickets}
        campaignName={campaign.name} // <--- ADD THIS LINE
        disabled={stage !== RouletteStage.PREPARATION || loadingTickets}
      />
    </div>
  </div>
))}
                </div>
              </div>

              {/* DYNAMIC GUIDANCE & TRANSPARENCY BOX */}
              <div className="shrink-0 flex flex-col gap-2">
                <div className="rounded-xl border border-white/5 bg-[#0A0A0A]/50 backdrop-blur-md p-4 shadow-lg">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="text-accentPurple">✦</span> Round Status
                  </h3>
                  
                  <div className="space-y-4">
                    <p className="text-xs text-white/60 leading-relaxed italic">
                      {stage === RouletteStage.PREPARATION 
                        ? `Round #${roundId || '?'} is open. Place your bets before time runs out.` 
                        : `Round #${roundId || '?'} is currently resolving on-chain.`}
                    </p>

                    {stage === RouletteStage.PREPARATION ? (
                      <ul className="space-y-2 border-t border-white/5 pt-3">
                        <li className="flex gap-2 items-center text-[11px] text-white/50">
                          <span className="w-1 h-1 rounded-full bg-accentPurple" />
                          Drag tickets to multiplier zones
                        </li>
                        <li className="flex gap-2 items-center text-[11px] text-white/50">
                          <span className="w-1 h-1 rounded-full bg-accentPurple" />
                          Confirm on-chain to finalize
                        </li>
                      </ul>
                    ) : (
                      /* TRANSPARENCY BAR (Only visible during resolution/result) */
                      stageInfo && (
                        <div className="border-t border-white/5 pt-3">
                          <button 
                            onClick={() => setShowInfo(!showInfo)}
                            className="w-full flex items-center justify-between text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors"
                          >
                            Transparency Data
                            {showInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          
                          {showInfo && (
                            <div className="mt-2 bg-black/40 rounded-lg p-3 overflow-hidden border border-white/5">
                              <div className="flex flex-col gap-3">
                                {stageInfo.tx && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] text-white/30 uppercase">Last Transaction</span>
                                    <a 
                                      href={`https://monad-explorer.com/tx/${stageInfo.tx}`} 
                                      target="_blank" 
                                      className="text-[10px] text-accentPurple flex items-center gap-1 hover:underline"
                                    >
                                      {stageInfo.tx.substring(0, 12)}...{stageInfo.tx.substring(stageInfo.tx.length - 8)} 
                                      <ExternalLink size={10} />
                                    </a>
                                  </div>
                                )}
                                <div className="flex flex-col gap-1">
                                  <span className="text-[8px] text-white/30 uppercase">Raw JSON Output</span>
                                  <pre className="text-[9px] font-mono text-white/20 overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-[120px]">
                                    {JSON.stringify(stageInfo, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}