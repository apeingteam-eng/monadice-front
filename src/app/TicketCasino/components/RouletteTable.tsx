"use client";

import React, { useMemo } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import ERC721_ABI from "@/lib/ethers/abi/erc721.json";
import { readContract } from "@wagmi/core";

// ✅ NEW
import { simulateContract } from "@wagmi/core";

import { BetTypeKey, PlacedBet } from "../types";
import { config } from "@/app/providers";
import Image from "next/image";
import api from "@/config/api";

interface WagmiError extends Error {
  shortMessage?: string;
  walk?: (
    fn: (e: { data?: { message?: string }; message: string }) => string | undefined
  ) => string | undefined;
}

const ROULETTE_CONTRACT_ADDRESS =
  "0x5bd22d71E1Ab3B6Ef62AaC92Bd56bA9fBB23e31B";

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
  | {
      id: string;
      label: string;
      betType: "LOW" | "HIGH" | "RED" | "BLACK" | "ODD" | "EVEN";
      numbers: number[];
      param: number;
    };

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function getBetLabel(bet: PlacedBet): string {
  switch (bet.betType) {
    case "STRAIGHT":
      return `Number ${bet.numbers[0] === 37 ? "00" : bet.numbers[0]}`;
    case "DOZEN":
      return `${bet.param === 1 ? "1st" : bet.param === 2 ? "2nd" : "3rd"} Dozen`;
    case "COLUMN":
      return `${
        bet.param === 1 ? "Bottom" : bet.param === 2 ? "Middle" : "Top"
      } Col`;
    case "RED":
      return "Red";
    case "BLACK":
      return "Black";
    case "EVEN":
      return "Even";
    case "ODD":
      return "Odd";
    case "LOW":
      return "Low (1-18)";
    case "HIGH":
      return "High (19-36)";
    default:
      return String(bet.betType);
  }
}

const ROULETTE_ABI = [
  {
    name: "placeBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaign", type: "address" },
      { name: "ticketId", type: "uint256" },
      { name: "betType", type: "uint8" },
      { name: "numbers", type: "uint8[]" },
      { name: "param", type: "uint8" },
    ],
    outputs: [{ name: "betId", type: "uint256" }],
  },
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

  const groupedBets = useMemo(() => {
    const groups: Record<string, { name: string; bets: PlacedBet[] }> = {};
    placed.forEach((bet) => {
      if (!groups[bet.campaignAddress]) {
        groups[bet.campaignAddress] = { name: bet.campaignName, bets: [] };
      }
      groups[bet.campaignAddress].bets.push(bet);
    });
    return groups;
  }, [placed]);

  const totalStakeValue = useMemo(
    () => placed.reduce((sum, b) => sum + Number(b.stake || 0), 0),
    [placed]
  );

  function onDropZone(e: React.DragEvent, zone: Zone) {
    if (disabled) return;

    e.preventDefault();
    const raw = e.dataTransfer.getData("text/ticketUid");
    if (!raw) return;

    const parts = raw.split("|");
    if (parts.length < 7) return;

    const ticketUid = parts[0];
    const ticketId = Number(parts[1]);
    const campaignAddress = parts[2];
    const side = parts[3] === "1" || parts[3] === "true";
    const stake = parts[4] ? parseFloat(parts[4]) : 0;
    const campaignName = parts[5];
    const campaignId = Number(parts[6]);

    if (placed.some((b) => b.ticketUid === ticketUid)) return;

    const bet: PlacedBet = {
      id: uid(),
      zoneId: zone.id,
      ticketUid,
      ticketId,
      campaignId,
      campaignAddress,
      campaignName,
      betType: zone.betType as BetTypeKey,
      numbers: zone.numbers,
      param: zone.param,
      side,
      stake,
    };

    setPlaced((prev) => [...prev, bet]);
    removeTicketFromTray(ticketUid);
    setHoverZone(null);
  }

  function clearAll() {
    onClearAll(placed);
    setPlaced([]);
  }

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [isProcessing, setIsProcessing] = React.useState(false);

  async function handleConfirm() {
    if (placed.length === 0 || !address) return;
    setIsProcessing(true);

    const successfulBets: PlacedBet[] = [];

    try {
      // approvals
      const uniqueCampaigns = Array.from(
        new Set(placed.map((b) => b.campaignAddress as `0x${string}`))
      );

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

          await publicClient?.waitForTransactionReceipt({ hash });
        }
      }

      // place bets
      for (const bet of placed) {
        try {
          // ✅ simulate first
          await simulateContract(config, {
            address: ROULETTE_CONTRACT_ADDRESS as `0x${string}`,
            abi: ROULETTE_ABI,
            functionName: "placeBet",
            args: [
              bet.campaignAddress as `0x${string}`,
              BigInt(bet.ticketId),
              Number(BET_TYPE_MAP[bet.betType]),
              bet.numbers || [],
              Number(bet.param),
            ],
            account: address,
          });

          const hash = await writeContractAsync({
            address: ROULETTE_CONTRACT_ADDRESS as `0x${string}`,
            abi: ROULETTE_ABI,
            functionName: "placeBet",
            args: [
              bet.campaignAddress as `0x${string}`,
              BigInt(bet.ticketId),
              Number(BET_TYPE_MAP[bet.betType]),
              bet.numbers || [],
              Number(bet.param),
            ],
          });

          await publicClient?.waitForTransactionReceipt({ hash });

          successfulBets.push(bet);
        } catch (betErr) {
          console.error(`Bet failed`, betErr);
          break;
        }
      }

      if (successfulBets.length > 0) {
        const payload = {
          user_address: address,
          bets: successfulBets.map((bet) => ({
            campaign_id: bet.campaignId,
            ticket_id: bet.ticketId,
            bet_type: BET_TYPE_MAP[bet.betType],
            numbers: bet.numbers || [],
            param: Number(bet.param),
            stake: Number(bet.stake),
            zone_id: bet.zoneId,
          })),
        };

        await api.post("/roulette/bets", payload);

        const successfulUids = successfulBets.map((b) => b.ticketUid);
        setPlaced((prev) => prev.filter((p) => !successfulUids.includes(p.ticketUid)));

        alert("Bets submitted.");
      }
    } catch (err) {
      const error = err as WagmiError;
      const reason =
        error.walk?.((e) => (e as any).data?.message || (e as any).message) ??
        error.message;
      alert(reason);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div
      className={`w-full pt-12 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="relative w-full border border-white/10 bg-black/40 rounded-none md:rounded-2xl shadow-2xl">
        <div className="absolute inset-0 rounded-none md:rounded-2xl ring-1 ring-white/10 pointer-events-none" />

        <div className="relative w-full aspect-[2912/1472]">
          <Image
            src="/MonadiceTable.png"
            alt="Roulette Table"
            fill
            priority
            className="object-cover select-none"
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
              {renderNumberGrid(
                zones,
                placed,
                hoverZone,
                setHoverZone,
                onDropZone
              )}
            </div>

            <div
              className="absolute left-[11.5%] right-[11.5%] top-[61%] h-[10%]"
              style={{
                display: "grid",
                gridTemplateColumns: "34% 33% 33%",
              }}
            >
              {renderZonesByIds(
                zones,
                ["dozen_1", "dozen_2", "dozen_3"],
                placed,
                hoverZone,
                setHoverZone,
                onDropZone
              )}
            </div>

            <div
              className="absolute left-[11.5%] right-[11.5%] top-[70%] h-[10%]"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
              }}
            >
              {renderZonesByIds(
                zones,
                ["low", "even", "red", "black", "odd", "high"],
                placed,
                hoverZone,
                setHoverZone,
                onDropZone
              )}
            </div>
          </div>
        </div>
      </div>

      {placed.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#0A0A0A]/80 border border-white/10 overflow-hidden shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase text-white/90 tracking-wider">
                Bet Slip
              </span>
              <span className="bg-accentPurple/20 text-accentPurple text-[10px] px-2 py-0.5 rounded-full font-bold">
                {placed.length} TOTAL
              </span>
            </div>

            <span className="text-xs font-mono text-green-400 font-bold">
              Total Stake: ${totalStakeValue.toFixed(2)}
            </span>
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto space-y-6">
            {Object.entries(groupedBets).map(([addr, group]) => (
              <div key={addr} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1 h-3 bg-accentPurple rounded-full" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest truncate">
                    {group.name}
                    <span className="text-white/20 ml-2 font-mono">
                      ({addr.slice(0, 4)}...{addr.slice(-4)})
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.bets.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-black/40 border border-white/5"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                          b.side
                            ? "bg-green-900/40 border-green-500 text-green-400"
                            : "bg-red-900/40 border-red-500 text-red-400"
                        }`}
                      >
                        #{b.ticketId}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate">
                          {getBetLabel(b)}
                        </span>
                        <span className="text-[10px] text-white/40 font-mono">
                          ${Number(b.stake).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between px-2">
        <div className="text-sm text-white/70">
          {isProcessing
            ? "Check your wallet..."
            : disabled
            ? "Round in progress..."
            : "Ready to spin?"}
        </div>

        <div className="flex gap-3">
          <button
            onClick={clearAll}
            disabled={placed.length === 0 || disabled || isProcessing}
            className="rounded-lg border px/4 py-2"
          >
            Clear All
          </button>

          <button
            onClick={handleConfirm}
            disabled={placed.length === 0 || disabled || isProcessing}
          >
            Confirm & Spin
          </button>
        </div>
      </div>
    </div>
  );
}

function renderNumberGrid(
  zones: Zone[],
  placed: PlacedBet[],
  hoverZone: string | null,
  setHoverZone: (i: string | null) => void,
  onDrop: any
) {
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

  return cells.map((zone, i) => {
    if (!zone) return <div key={i} />;

    return (
      <DropZone
        key={zone.id}
        zone={zone}
        bets={placed.filter((p) => p.zoneId === zone.id)}
        isHover={hoverZone === zone.id}
        onHover={setHoverZone}
        onDrop={onDrop}
      />
    );
  });
}

function rowNumbers(zones: Zone[], nums: number[]) {
  return nums.map((n) => findZone(zones, `straight_${n}`));
}

function renderZonesByIds(
  zones: Zone[],
  ids: string[],
  placed: PlacedBet[],
  hover: string | null,
  setHover: any,
  onDrop: any
) {
  return ids.map((id) => {
    const z = findZone(zones, id);

    return (
      <DropZone
        key={z.id}
        zone={z}
        bets={placed.filter((p) => p.zoneId === z.id)}
        isHover={hover === z.id}
        onHover={setHover}
        onDrop={onDrop}
      />
    );
  });
}

function findZone(zones: Zone[], id: string) {
  const z = zones.find((x) => x.id === id);
  if (!z) throw new Error("Zone not found " + id);
  return z;
}

function DropZone({ zone, bets, isHover, onHover, onDrop }) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onHover(zone.id);
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => onHover(null)}
      onDrop={(e) => onDrop(e, zone)}
      className="relative"
    >
      {bets.length > 0 && (
        <div className="relative">
          {bets.map((b, i) => (
            <div
              key={b.id}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%, calc(-50% - ${i * 4}px))`,
              }}
            >
              <Chip bet={b} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ bet }) {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center border text-xs">
      #{bet.ticketId}
    </div>
  );
}

function buildZones(): Zone[] {
  const zones: Zone[] = [];

  for (let n = 0; n <= 36; n++) {
    zones.push({
      id: `straight_${n}`,
      label: `${n}`,
      betType: "STRAIGHT",
      numbers: [n],
      param: 0,
    });
  }

  zones.push({
    id: "straight_37",
    label: "00",
    betType: "STRAIGHT",
    numbers: [37],
    param: 0,
  });

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
