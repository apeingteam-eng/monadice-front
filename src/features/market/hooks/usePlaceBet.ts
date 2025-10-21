export function usePlaceBet() {
  // placeholder mutate function
  const placeBet = async (_marketId: string, _outcome: string, _amount: number) => {
    return { txHash: "0x" };
  };
  return { placeBet, isPlacing: false, error: null as unknown };
}




