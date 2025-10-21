// Dummy data for now
// TODO: integrate real API
import type { MarketSummary } from "@/components/MarketCard";

export type OddsPoint = { t: string; v: number };

export type DetailedMarket = {
  id: string;
  title: string;
  description: string;
  outcomes: Array<{ label: string; percent: number }>;
  oddsHistory: OddsPoint[];
  volumeUsd: number;
  totalBets: number;
  category: "Sports" | "Business" | "Crypto" | "Entertainment" | "Politics";
  expiresAt: string; // ISO date
  bannerUrl?: string;
};

export const detailedMarkets: DetailedMarket[] = [
  {
    id: "nyc-mayor-2025",
    title: "New York City Mayoral Election",
    description:
      "Who will win the next New York City Mayoral election? This market tracks the leading candidate odds and sentiment.",
    outcomes: [
      { label: "Yes", percent: 91 },
      { label: "No", percent: 9 },
    ],
    oddsHistory: [
      { t: "-7d", v: 84 },
      { t: "-3d", v: 88 },
      { t: "-1d", v: 90 },
      { t: "now", v: 91 },
    ],
    volumeUsd: 190_000_000,
    totalBets: 520_341,
    category: "Politics",
    expiresAt: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
    bannerUrl: "/globe.svg",
  },
  {
    id: "btc-100k-2025",
    title: "Bitcoin to close above $100k in 2025",
    description:
      "Will BTC/USD close the year 2025 above $100,000 on major exchanges?",
    outcomes: [
      { label: "Yes", percent: 56 },
      { label: "No", percent: 44 },
    ],
    oddsHistory: [
      { t: "-7d", v: 52 },
      { t: "-3d", v: 55 },
      { t: "-1d", v: 57 },
      { t: "now", v: 56 },
    ],
    volumeUsd: 82_500_000,
    totalBets: 210_112,
    category: "Crypto",
    expiresAt: new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString(),
    bannerUrl: "/window.svg",
  },
  {
    id: "eth-etf-approval",
    title: "ETH Spot ETF approved by year-end",
    description:
      "Will a U.S.-listed spot Ethereum ETF receive approval by the end of the year?",
    outcomes: [
      { label: "Yes", percent: 63 },
      { label: "No", percent: 37 },
    ],
    oddsHistory: [
      { t: "-7d", v: 47 },
      { t: "-3d", v: 55 },
      { t: "-1d", v: 61 },
      { t: "now", v: 63 },
    ],
    volumeUsd: 21_300_000,
    totalBets: 43_551,
    category: "Crypto",
    expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    bannerUrl: "/file.svg",
  },
  {
    id: "nvidia-earnings-beat",
    title: "NVIDIA beats earnings next quarter",
    description:
      "Will NVIDIA (NVDA) beat consensus EPS estimates in the next quarterly report?",
    outcomes: [
      { label: "Yes", percent: 72 },
      { label: "No", percent: 28 },
    ],
    oddsHistory: [
      { t: "-7d", v: 65 },
      { t: "-3d", v: 69 },
      { t: "-1d", v: 71 },
      { t: "now", v: 72 },
    ],
    volumeUsd: 44_100_000,
    totalBets: 120_009,
    category: "Business",
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "olympics-records",
    title: "10+ world records at next Olympics",
    description:
      "Will more than 10 athletic world records be broken during the next Olympic Games?",
    outcomes: [
      { label: "Yes", percent: 48 },
      { label: "No", percent: 52 },
    ],
    oddsHistory: [
      { t: "-7d", v: 41 },
      { t: "-3d", v: 46 },
      { t: "-1d", v: 47 },
      { t: "now", v: 48 },
    ],
    volumeUsd: 12_800_000,
    totalBets: 18_221,
    category: "Sports",
    expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "rain-in-london",
    title: "Rain in London this weekend",
    description:
      "Will there be measurable rainfall in London this coming weekend?",
    outcomes: [
      { label: "Yes", percent: 69 },
      { label: "No", percent: 31 },
    ],
    oddsHistory: [
      { t: "-7d", v: 55 },
      { t: "-3d", v: 62 },
      { t: "-1d", v: 67 },
      { t: "now", v: 69 },
    ],
    volumeUsd: 2_350_000,
    totalBets: 4_909,
    category: "Entertainment",
    expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
  },
];

export const dummyMarkets: MarketSummary[] = detailedMarkets.map((m) => ({
  id: m.id,
  title: m.title,
  outcomes: m.outcomes,
  volumeUsd: m.volumeUsd,
  category: m.category,
}));

export function getDummyMarketById(id: string): DetailedMarket | undefined {
  return detailedMarkets.find((m) => m.id === id);
}


