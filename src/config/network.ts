// src/config/network.ts

export const NETWORKS = {
  baseSepolia: {
    chainId: 84532,
    name: "base-sepolia",
    rpcUrl: "https://sepolia.base.org",
    usdcDecimals: 6,
    addresses: {
      FACTORY: "0x9a55436F713052B38F98E1Be0c569A078576aD57",
      USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
  },

  // ---- Example of adding more chains later ----
  mocaTestnet: {
    chainId: 20240215,
    name: "moca-testnet",
    rpcUrl: "https://testnet.mocachain.xyz",
    usdcDecimals: 6,
    addresses: {
      FACTORY: "",
      USDC: "",
    },
  },

  monadMainnet: {
    chainId: 99999,
    name: "monad-mainnet",
    rpcUrl: "https://rpc.monad.xyz",
    usdcDecimals: 6,
    addresses: {
      FACTORY: "",
      USDC: "",
    },
  },
} as const;

export type SupportedNetwork = keyof typeof NETWORKS;

// Pick the active network here:
export const ACTIVE_NETWORK: SupportedNetwork = "baseSepolia";

// Export active chain config everywhere:
export const CHAIN = NETWORKS[ACTIVE_NETWORK];