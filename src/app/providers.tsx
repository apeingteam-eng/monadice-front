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
import { baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- WalletConnect project id (from https://cloud.walletconnect.com) ---
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo';

// --- RainbowKit wallets setup ---
const { wallets, connectors } = getDefaultWallets({
  appName: 'Monadice',
  projectId,
});

// --- wagmi configuration (v2 syntax) ---
const config = createConfig({
  chains: [baseSepolia],
  connectors,
  transports: {
    [baseSepolia.id]: http(), // public RPC by default
  },
});

const queryClient = new QueryClient();

// --- Global provider wrapper ---
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()} locale="en">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
