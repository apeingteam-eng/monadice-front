"use client";

import React, { useMemo, useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { ExternalLink } from "lucide-react";
import ERC721_ABI from "@/lib/ethers/abi/erc721.json";
import { readContract } from "@wagmi/core";
import { 
  BetType,
  BetTypeKey,
  PlacedBet, 
} from "../types";
import { config } from "@/app/providers";

// --- CONTRACT CONSTANTS ---
const ROULETTE_CONTRACT_ADDRESS = "0xC44EE941AADB30A287e1F7C06026f9a8cBc435B7";

// --- CONTRACT ENUM MAPPING ---
const BET_TYPE_MAP: Record<string, number> = {
  STRAIGHT: 0,
  DOZEN: 6,
  COLUMN: 7,
  LOW: 8,
  HIGH: 9,
  RED: 10,
  BLACK: 11,
  ODD: 12,
  EVEN: 13,
};


type Zone =
  | { id: string; label: string; betType: "STRAIGHT"; numbers: number[]; param: number }
  | { id: string; label: string; betType: "DOZEN"; numbers: number[]; param: 1 | 2 | 3 }
  | { id: string; label: string; betType: "COLUMN"; numbers: number[]; param: 1 | 2 | 3 }
  | { id: string; label: string; betType: "LOW" | "HIGH" | "RED" | "BLACK" | "ODD" | "EVEN"; numbers: number[]; param: number };



function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function getBetLabel(bet: PlacedBet): string {
  switch (bet.betType) {
    case "STRAIGHT": return `Number ${bet.numbers[0] === 37 ? "00" : bet.numbers[0]}`;
    case "DOZEN": return `${bet.param === 1 ? "1st" : bet.param === 2 ? "2nd" : "3rd"} Dozen`;
    case "COLUMN": return `${bet.param === 1 ? "Bottom" : bet.param === 2 ? "Middle" : "Top"} Col`;
    case "RED": return "Red";
    case "BLACK": return "Black";
    case "EVEN": return "Even";
    case "ODD": return "Odd";
    case "LOW": return "Low (1-18)";
    case "HIGH": return "High (19-36)";
    default: return String(bet.betType); // Safety cast
  }
}

const ROULETTE_ABI = [
  {
    name: "placeBet",
    type: "function",
    stateMutability: "nonReentrant",
    inputs: [
      { name: "campaign", type: "address" },
      { name: "ticketId", type: "uint256" },
      { name: "betType", type: "uint8" },
      { name: "numbers", type: "uint8[]" },
      { name: "param", type: "uint8" }
    ],
    outputs: [{ name: "betId", type: "uint256" }]
  }
] as const;

export default function RouletteTable({
  placed,
  setPlaced,
  removeTicketFromTray,
  onClearAll,
  disabled = false,
}: {
  placed: PlacedBet[];
  setPlaced: React.Dispatch<React.SetStateAction<PlacedBet[]>>;
  removeTicketFromTray: (uid: string) => void;
  onClearAll: (placed: PlacedBet[]) => void;
  disabled?: boolean;
}) {
  const [hoverZone, setHoverZone] = React.useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();
  const zones = useMemo(() => buildZones(), []);

  // Fix: Group bets by campaign Name (and address) for the slip
  // Groups bets by campaign Address but includes the Name for the header
  const groupedBets = useMemo(() => {
    const groups: Record<string, { name: string; bets: PlacedBet[] }> = {};
    placed.forEach((bet) => {
      const key = bet.campaignAddress;
      if (!groups[key]) {
        groups[key] = { name: bet.campaignName, bets: [] };
      }
      groups[key].bets.push(bet);
    });
    return groups;
  }, [placed]);
  // Fix: Correct Total Value calculation (ensure numeric stake)
  const totalStakeValue = useMemo(() => {
    return placed.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  }, [placed]);

  function onDropZone(e: React.DragEvent, zone: Zone) {
    if (disabled) return;
    e.preventDefault();

    const raw = e.dataTransfer.getData("text/ticketUid");
    if (!raw) return;

    const parts = raw.split("|");
    // Parts: [0:uid, 1:ticketId, 2:campaignAddress, 3:side, 4:stake, 5:campaignName]
    if (parts.length < 6) return; // Change to 6 to be safe

    const ticketUid = parts[0];
    const ticketId = Number(parts[1]);
    const campaignAddress = parts[2];
    const side = parts[3] === "1" || parts[3] === "true"; 
    const stake = parts[4] ? parseFloat(parts[4]) : 0;
    const campaignName = parts[5]; // <--- This will now have the name from props

    if (placed.some((b) => b.ticketUid === ticketUid)) return;

  const bet: PlacedBet = {
      id: uid(),
      zoneId: zone.id,
      ticketUid,
      ticketId,
      campaignAddress,
      campaignName, 
      // Cast the zone's specific string type to the general BetTypeKey
      betType: zone.betType as BetTypeKey, 
      numbers: zone.numbers,
      param: zone.param,
      side,
      stake
    };

    setPlaced((prev) => [...prev, bet]);
    removeTicketFromTray(ticketUid);
    setHoverZone(null);
  }
  function clearAll() {
    onClearAll(placed); // Restores to tray via parent logic
    setPlaced([]);
  }

  // Inside RouletteTable component
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [isProcessing, setIsProcessing] = React.useState(false);

  async function handleConfirm() {
    if (placed.length === 0 || !address) return;
    setIsProcessing(true);

    try {
      // 1. Gather unique campaigns for approval check
      const uniqueCampaigns = Array.from(
        new Set(placed.map((b) => b.campaignAddress as `0x${string}`))
      );

      // 2. Step 1: Sequential NFT Approvals
      for (const campaign of uniqueCampaigns) {
        const isApproved = await readContract(config, {
          address: campaign,
          abi: ERC721_ABI,
          functionName: "isApprovedForAll",
          args: [address, ROULETTE_CONTRACT_ADDRESS as `0x${string}`],
        });

        if (!isApproved) {
          const hash = await writeContractAsync({
            address: campaign,
            abi: ERC721_ABI,
            functionName: "setApprovalForAll",
            args: [ROULETTE_CONTRACT_ADDRESS as `0x${string}`, true],
          });
          // Wait for block confirmation
          await publicClient?.waitForTransactionReceipt({ hash });
        }
      }

      // 3. Step 2: Sequential Bet Placement
      // We loop using for...of to ensure 'await' pauses the loop correctly
      for (const bet of placed) {
        console.log(`Submitting Bet for Ticket #${bet.ticketId}...`);
        
        const hash = await writeContractAsync({
          address: ROULETTE_CONTRACT_ADDRESS as `0x${string}`,
          abi: ROULETTE_ABI,
          functionName: "placeBet",
          args: [
            bet.campaignAddress as `0x${string}`,
            BigInt(bet.ticketId),
            Number(BET_TYPE_MAP[bet.betType]), // Cast to Number (uint8)
            bet.numbers || [],                 // Ensure numbers is never null
            Number(bet.param),                 // Cast to Number (uint8)
          ],
        });

        // CRITICAL: Wait for the bet to be mined before sending the next one
        // This prevents 'nonReentrant' reverts and nonce collisions
        await publicClient?.waitForTransactionReceipt({ hash });
        console.log(`Bet for Ticket #${bet.ticketId} Confirmed!`);
      }

      alert("Success! All bets have been placed on the blockchain.");
      setPlaced([]);
   } catch (err: any) {
  console.error("Betting Flow Error:", err);
  
  const revertReason = err.walk?.((e: any) => e.data?.message || e.message);
  
  // Specific check for the whitelist revert string in your contract
  if (revertReason?.includes("campaign not allowed")) {
    alert("Error: This market collection is not whitelisted for the Roulette.");
  } else if (err.name === 'UserRejectedRequestError' || err.message.includes("rejected")) {
    alert("Transaction cancelled by user.");
  } else {
    alert(`Error: ${revertReason || "The transaction reverted. Check your balance or if the round is closed."}`);
  }

    } finally {
      setIsProcessing(false);
    }
  }
  return (
   <div className={`w-full pt-12 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
    <div className="relative w-full border border-white/10 bg-black/40 rounded-none md:rounded-2xl shadow-2xl">
      <div className="absolute inset-0 rounded-none md:rounded-2xl ring-1 ring-white/10 pointer-events-none" />
      <div className="relative w-full aspect-[2912/1472]">
        <img
          src="/MonadiceTable.png"
          alt="Roulette Table"
          className="absolute inset-0 h-full w-full object-cover select-none"
          draggable={false}
        />

        <div className="absolute inset-0">
          <div
            className="absolute left-[4.5%] right-[4.5%] top-[14%] h-[46%]"
            style={{
              display: "grid",
              gridTemplateColumns: "7% repeat(12, 1fr) 7%", 
              gridTemplateRows: "repeat(3, 5fr)",
            }}
          >
            {renderNumberGrid(zones, placed, hoverZone, setHoverZone, onDropZone)}
          </div>

          <div
            className="absolute left-[11.5%] right-[11.5%] top-[61%] h-[10%]"
            style={{
              display: "grid",
              gridTemplateColumns: "34% 33% 33%",
              gridTemplateRows: "1fr",
            }}
          >
            {renderZonesByIds(zones, ["dozen_1", "dozen_2", "dozen_3"], placed, hoverZone, setHoverZone, onDropZone)}
          </div>

          <div
            className="absolute left-[11.5%] right-[11.5%] top-[70%] h-[10%]"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gridTemplateRows: "1fr",
            }}
          >
            {renderZonesByIds(zones, ["low", "even", "red", "black", "odd", "high"], placed, hoverZone, setHoverZone, onDropZone)}
          </div>
        </div>
      </div>
    </div>

    {/* --- FIXED BET SLIP SUMMARY --- */}
    {/* --- FIXED BET SLIP SUMMARY --- */}
    {placed.length > 0 && (
      <div className="mt-4 rounded-xl bg-[#0A0A0A]/80 border border-white/10 overflow-hidden shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase text-white/90 tracking-wider">Bet Slip</span>
            <span className="bg-accentPurple/20 text-accentPurple text-[10px] px-2 py-0.5 rounded-full font-bold">{placed.length} TOTAL</span>
          </div>
          <span className="text-xs font-mono text-green-400 font-bold">
            Total Stake: ${totalStakeValue.toFixed(2)}
          </span>
        </div>

        <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-6">
          {Object.entries(groupedBets).map(([campaignAddr, group]) => (
            <div key={campaignAddr} className="space-y-3">
              {/* Market Name Header - Now using group.name */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-3 bg-accentPurple rounded-full" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest truncate">
                  {group.name} 
                  <span className="text-white/20 ml-2 font-mono">
                    ({campaignAddr.slice(0, 4)}...{campaignAddr.slice(-4)})
                  </span>
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.bets.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 transition group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold border shrink-0 ${b.side ? "bg-green-900/40 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)]" : "bg-red-900/40 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]"}`}>
                      #{b.ticketId}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate" title={getBetLabel(b)}>{getBetLabel(b)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 font-mono">${Number(b.stake).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Controls */}
   <div className="mt-4 flex items-center justify-between gap-4 px-2">
      <div className="text-sm text-white/70">
        {isProcessing ? (
          <span className="flex items-center gap-2">
             <div className="w-2 h-2 bg-accentPurple rounded-full animate-ping" />
             Check your wallet...
          </span>
        ) : disabled ? (
          "Round in progress..."
        ) : (
          "Ready to spin?"
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={clearAll}
          disabled={placed.length === 0 || disabled || isProcessing}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50 transition"
        >
          Clear All
        </button>
        <button
          onClick={handleConfirm}
          disabled={placed.length === 0 || disabled || isProcessing}
          className="rounded-lg bg-accentPurple px-6 py-2 text-sm font-bold text-black hover:bg-accentPurple/90 hover:scale-105 transition disabled:opacity-50 disabled:grayscale flex items-center gap-2"
        >
          {isProcessing && (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          )}
          {isProcessing ? "Confirming..." : "Confirm & Spin"}
        </button>
      </div>
    </div>
  </div>
  );
}

// ... RENDER HELPERS, findZone, buildZones, rowNumbers, DropZone, Chip functions remain same as original ...

function renderNumberGrid(zones: Zone[], placed: PlacedBet[], hoverZone: string | null, setHoverZone: (id: string | null) => void, onDropZone: (e: React.DragEvent, zone: Zone) => void) {
  const cells: (Zone | null)[] = [];
  cells.push(findZone(zones, "straight_37")); 
  cells.push(...rowNumbers(zones, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]));
  cells.push(findZone(zones, "col_3")); 
  cells.push(null); 
  cells.push(...rowNumbers(zones, [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]));
  cells.push(findZone(zones, "col_2")); 
  cells.push(findZone(zones, "straight_0"));
  cells.push(...rowNumbers(zones, [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]));
  cells.push(findZone(zones, "col_1"));
  return cells.map((zone, idx) => {
    if (!zone) return <div key={idx} />;
    const zoneBets = placed.filter(p => p.zoneId === zone.id);
    return <DropZone key={zone.id} zone={zone} isHover={hoverZone === zone.id} bets={zoneBets} onHover={setHoverZone} onDrop={onDropZone} />;
  });
}

function rowNumbers(zones: Zone[], nums: number[]) {
  return nums.map((n) => findZone(zones, `straight_${n}`));
}

function renderZonesByIds(zones: Zone[], ids: string[], placed: PlacedBet[], hoverZone: string | null, setHoverZone: (id: string | null) => void, onDropZone: (e: React.DragEvent, zone: Zone) => void) {
  return ids.map((id) => {
    const z = findZone(zones, id);
    const zoneBets = placed.filter(p => p.zoneId === z.id);
    return <DropZone key={z.id} zone={z} bets={zoneBets} isHover={hoverZone === z.id} onHover={setHoverZone} onDrop={onDropZone} />;
  });
}

function findZone(zones: Zone[], id: string) {
  const z = zones.find((x) => x.id === id);
  if (!z) throw new Error(`Zone not found: ${id}`);
  return z;
}

function DropZone({ zone, bets, isHover, onHover, onDrop }: { zone: Zone; bets: PlacedBet[]; isHover: boolean; onHover: (id: string | null) => void; onDrop: (e: React.DragEvent, zone: Zone) => void }) {
  return (
    <div onDragOver={(e) => { e.preventDefault(); onHover(zone.id); e.dataTransfer.dropEffect = "copy"; }} onDragLeave={() => onHover(null)} onDrop={(e) => onDrop(e, zone)} className={`relative flex items-center justify-center transition duration-150 ${isHover ? "bg-accentPurple/20 ring-2 ring-accentPurple inset-ring z-10 rounded" : ""}`} title={zone.label}>
      {bets.length > 0 && (
        <div className="relative">
          {bets.map((bet, i) => (
            <div key={bet.id} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, calc(-50% - ${i * 4}px))`, zIndex: i }}>
              <Chip bet={bet} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ bet }: { bet: PlacedBet }) {
  const isYes = bet.side;
  return (
    <div className={`relative w-8 h-8 rounded-full border-2 shadow-xl flex items-center justify-center ${isYes ? "bg-[#051a05] border-green-500 text-green-400" : "bg-[#1a0505] border-red-500 text-red-400"}`}>
      <div className={`absolute inset-0.5 rounded-full border border-dashed opacity-50 ${isYes ? "border-green-500" : "border-red-500"}`} />
      <div className="relative z-10 flex flex-col items-center leading-none">
        <span className="text-[7px] font-bold opacity-70">#{bet.ticketId}</span>
      </div>
    </div>
  );
}

function buildZones(): Zone[] {
  const zones: Zone[] = [];
  for (let n = 0; n <= 36; n++) {
    zones.push({ id: `straight_${n}`, label: `${n}`, betType: "STRAIGHT", numbers: [n], param: 0 });
  }
  zones.push({ id: "straight_37", label: "00", betType: "STRAIGHT", numbers: [37], param: 0 });
  zones.push({ id: "dozen_1", label: "1st 12", betType: "DOZEN", numbers: [], param: 1 });
  zones.push({ id: "dozen_2", label: "2nd 12", betType: "DOZEN", numbers: [], param: 2 });
  zones.push({ id: "dozen_3", label: "3rd 12", betType: "DOZEN", numbers: [], param: 3 });
  zones.push({ id: "col_3", label: "2to1 Top", betType: "COLUMN", numbers: [], param: 3 });
  zones.push({ id: "col_2", label: "2to1 Mid", betType: "COLUMN", numbers: [], param: 2 });
  zones.push({ id: "col_1", label: "2to1 Bot", betType: "COLUMN", numbers: [], param: 1 });
  zones.push({ id: "low", label: "1-18", betType: "LOW", numbers: [], param: 0 });
  zones.push({ id: "even", label: "Even", betType: "EVEN", numbers: [], param: 0 });
  zones.push({ id: "red", label: "Red", betType: "RED", numbers: [], param: 0 });
  zones.push({ id: "black", label: "Black", betType: "BLACK", numbers: [], param: 0 });
  zones.push({ id: "odd", label: "Odd", betType: "ODD", numbers: [], param: 0 });
  zones.push({ id: "high", label: "High", betType: "HIGH", numbers: [], param: 0 });
  return zones;
}