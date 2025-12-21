export enum RouletteStage {
  PREPARATION = "PREPARATION",
  RESOLUTION = "RESOLUTION",
  RESULT = "RESULT",
}

// EXACT MATCH TO SOLIDITY ENUM: 
// STRAIGHT=0, SPLIT=1, ..., EVEN=13
export enum BetType {
  STRAIGHT,
  SPLIT,
  STREET,
  CORNER,
  FIVE_NUMBER,
  LINE,
  DOZEN,
  COLUMN,
  LOW,
  HIGH,
  RED,
  BLACK,
  ODD,
  EVEN,
}

// Use string literals for the Table component's logic 
// while mapping to the BetType enum for the contract
export type BetTypeKey =
  | "STRAIGHT"
  | "DOZEN"
  | "COLUMN"
  | "LOW"
  | "HIGH"
  | "RED"
  | "BLACK"
  | "ODD"
  | "EVEN";

/**
 * TRAY TICKET
 * Represents a ticket sitting in the user's sidebar
 */
export type TrayTicket = {
  uid: string;
  ticketId: number;
  campaignAddress: string;
  campaignName: string; 
  side: boolean;
  stake: number;
  imageUrl: string;
  payout: number | null;
};

/**
 * PLACED BET
 * Represents a ticket that has been dragged onto the table
 */
export type PlacedBet = {
  id: string;
  zoneId: string;
  ticketUid: string;
  ticketId: number;
  campaignAddress: string;
  campaignName: string;
  betType: BetTypeKey; 
  numbers: number[];
  param: number;
  side: boolean;
  stake: number;
};

/**
 * CAMPAIGN GROUP
 * Container for tickets grouped by market
 */
export type CampaignGroup = {
  campaignId: number;
  campaignAddress: string;
  name: string;
  state: "open" | "resolved";
  endTime: number;
  odds: {
    yes: number;
    no: number;
  };
  tickets: TrayTicket[];
};

export type DraftBet = {
  ticketId: bigint;
  betType: BetType;
  numbers?: number[];
  param?: number;
};

export type RouletteRound = {
  roundId: number;
  bettingClosesAt: number;
  resolved: boolean;
  randomRequested: boolean;
  resultNumber: number | null;
};