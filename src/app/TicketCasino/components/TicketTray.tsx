"use client";

import Image from "next/image";
import { 
  TrayTicket, 
} from "../types";


type TicketTrayProps = {
  tickets: TrayTicket[];
  disabled?: boolean;
  campaignName: string; // <--- ADD THIS PROP
};

export default function TicketTray({
  tickets,
  disabled = false,
  campaignName, // <--- DESTRUCTURE THIS
}: TicketTrayProps) {
  if (tickets.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 pt-2 px-1">
        {tickets.map((t) => {
          const side = Boolean(t.side);
          const stake = Number.isFinite(t.stake) ? t.stake : 0;
          const payout = typeof t.payout === "number" ? t.payout : null;
          const isYes = side;

          return (
            <div
              key={t.uid}
              draggable={!disabled}
              onDragStart={(e) => {
                if (disabled) return;
                // Use campaignName from PROPS, not from t.campaignName (which might be empty)
                e.dataTransfer.setData(
                  "text/ticketUid",
                  `${t.uid}|${t.ticketId}|${t.campaignAddress}|${t.side ? '1' : '0'}|${t.stake}|${campaignName}`
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              className={`
                group relative shrink-0 w-[100px] select-none
                flex flex-col items-center
                rounded-xl border
                transition-all duration-300 ease-out
                ${
                  disabled
                    ? "opacity-40 cursor-not-allowed border-white/5 bg-white/5 grayscale"
                    : "cursor-grab active:cursor-grabbing hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/50"
                }
                ${
                  isYes
                    ? "border-green-500/20 bg-gradient-to-b from-green-900/10 to-[#0a0a0a]"
                    : "border-red-500/20 bg-gradient-to-b from-red-900/10 to-[#0a0a0a]"
                }
              `}
            >
              {/* Outcome Badge */}
              <div
                className={`
                  absolute -top-2.5 left-1/2 -translate-x-1/2
                  px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border
                  shadow-sm z-10
                  ${
                    isYes
                      ? "bg-[#051a05] border-green-500/40 text-green-400 shadow-green-900/20"
                      : "bg-[#1a0505] border-red-500/40 text-red-400 shadow-red-900/20"
                  }
                `}
              >
                {isYes ? "YES" : "NO"}
              </div>

              <div className="w-full p-2 flex flex-col items-center gap-2 pt-5 pb-3">
                <div className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center shadow-inner
                  bg-black/60 border
                  ${isYes ? "border-green-500/10" : "border-red-500/10"}
                `}>
                  <Image
                    src={t.imageUrl}
                    alt={`#${t.ticketId}`}
                    width={28}
                    height={28}
                    className="object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
                    draggable={false}
                  />
                </div>

                <div className="text-center w-full space-y-0.5">
                  <div className="text-[9px] text-white/30 font-mono">
                    #{t.ticketId}
                  </div>
                  <div className="flex flex-col items-center leading-tight">
                    <span className={`text-xs font-bold ${isYes ? "text-green-100" : "text-red-100"}`}>
                      ${stake.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`w-full h-1 rounded-b-xl ${isYes ? "bg-green-500/20" : "bg-red-500/20"}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}