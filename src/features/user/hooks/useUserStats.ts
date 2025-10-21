export function useUserStats(address?: string) {
  return { address, wins: 0, losses: 0, pnl: 0, isLoading: false, error: null as unknown };
}




