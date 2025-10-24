// src/features/user/utils/betService.ts
import api from "@/config/api";
import { getAuthHeader } from "./userService";

export interface UserBet {
  id: number;
  ticket_id: number;
  campaign_address: string;
  stake: number;
  claimed: boolean;
  side: boolean;
  created_at: string;
  payout: number | null;
  tx_hash: string;
}

export async function getUserBets(): Promise<UserBet[]> {
  const headers = await getAuthHeader();
  const res = await api.get<{ bets: UserBet[] }>("/bet/me/user-bets", {
    headers,
  });
  return res.data.bets;
}
