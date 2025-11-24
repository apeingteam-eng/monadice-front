'use client';

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';

import {
  RainbowKitProvider,
  getDefaultWallets,
  darkTheme,
} from '@rainbow-me/rainbowkit';

import {
  WagmiProvider,
  createConfig,
  http,
} from 'wagmi';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------
// 🚀 Monad Mainnet Chain
// ---------------------------------------------
const monadMainnet = {
  id: 143,
  name: "Monad",
  network: "monad-mainnet",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
    public: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "MonadVision",
      url: "https://monadvision.com",
    },
  },
} as const;

// ---------------------------------------------
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo';

// Wallet connectors
const { wallets, connectors } = getDefaultWallets({
  appName: "Monadice",
  projectId,
});

// Wagmi Config (v2)
const config = createConfig({
  chains: [monadMainnet],
  connectors,
  transports: {
    [monadMainnet.id]: http("https://rpc.monad.xyz"),
  },
});

// Queries
const queryClient = new QueryClient();

// ---------------------------------------------
// 🌍 Global Providers
// ---------------------------------------------
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/* ❌ REMOVE chains prop — RainbowKit v2 does NOT accept it */}
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}