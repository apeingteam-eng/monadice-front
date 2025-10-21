export function useClaim() {
  const claim = async (_marketId: string) => {
    return { txHash: "0x" };
  };
  return { claim, isClaiming: false, error: null as unknown };
}




