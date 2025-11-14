"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, parseUnits } from "ethers";

import ReactDatePicker from "react-datepicker";
import { addMinutes } from "date-fns";

import BetMarketFactoryABI from "@/lib/ethers/abi/BetMarketFactory.json";
import { CHAIN } from "@/config/network";
import { useToast } from "@/components/toast/ToastContext";

const USDC_ADDRESS = CHAIN.addresses.USDC;
const FACTORY_ADDRESS = CHAIN.addresses.FACTORY;
const CREATION_STAKE = "1";
const USDC_DECIMALS = 6;
const TARGET_CHAIN_ID = CHAIN.chainId;

export default function CreateMarketPage() {
  const router = useRouter();
  const toast = useToast();

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [category, setCategory] = useState("CRYPTO");
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const minSelectableDate = addMinutes(new Date(), 10);
  const [loading, setLoading] = useState(false);

  // ----------------------------------------------------------------
  //  DIRECT CREATE (NO VERIFY)
  // ----------------------------------------------------------------
  const handleCreate = async () => {
  if (!isConnected || !walletClient || !address) {
    toast.error("Wallet not connected.");
    return;
  }
  if (chainId !== TARGET_CHAIN_ID) {
    toast.error(`Switch to ${CHAIN.name}.`);
    return;
  }
  if (!title.trim()) {
    toast.error("Enter a market title.");
    return;
  }
  if (!selectedDate) {
    toast.error("Select an end date.");
    return;
  }

  try {
    setLoading(true);

    const endUnix = Math.floor(selectedDate.getTime() / 1000);
    const feeBps = 200;

    const provider = new BrowserProvider(walletClient.transport as any);
    const signer = await provider.getSigner(address);

    const usdc = new Contract(
      USDC_ADDRESS,
      [
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
      ],
      signer
    );

    const factory = new Contract(
      FACTORY_ADDRESS,
      BetMarketFactoryABI,
      signer
    );

    const stakeAmount = parseUnits(CREATION_STAKE, USDC_DECIMALS);

    // Check allowance
    const allowance = await usdc.allowance(address, FACTORY_ADDRESS);
    if (allowance < stakeAmount) {
      toast.info("Approving 1 USDC…");

      const tx1 = await usdc.approve(FACTORY_ADDRESS, stakeAmount);
      await tx1.wait();

      toast.success("USDC Approved!");
    }

    // Create campaign
    toast.info("Creating market…");

    const tx2 = await factory.createCampaign(
      title,
      category,
      endUnix,
      feeBps
    );
    const receipt = await tx2.wait();

    toast.success("Market created!");

    const event = receipt.logs
      .map((log: any) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((x: any) => x && x.name === "CampaignDeployed");

    if (!event) {
      toast.error("Market created but event missing.");
      return;
    }

    // ---------------------------------
    // BACKEND SYNC (IMPORTANT)
    // ---------------------------------
    toast.info("Syncing backend…");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/sync`);

      if (!res.ok) {
        toast.error("Backend sync failed.");
      } else {
        toast.success("Backend synced! 🎉");
      }
    } catch (e) {
      toast.error("Could not sync backend.");
    }

    toast.success("Redirecting…");

    router.push(`/market/${event.args.id.toString()}`);

  } catch (err: any) {
    toast.error(err.message || "Transaction failed.");
  } finally {
    setLoading(false);
  }
};
  // ----------------------------------------------------------------
  //  UI
  // ----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4">
      <div className="container mx-auto max-w-2xl space-y-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-accentPurple to-[#7a4edb] bg-clip-text text-transparent text-center">
          Create a New Market
        </h1>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-6">

          {/* Title */}
          <div>
            <label className="text-sm text-neutral-300">Market Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ETH to hit $4K by 2025"
              className="w-full mt-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm text-neutral-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            >
              {["CRYPTO", "SPORTS", "POLITICS", "SOCIAL"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-sm text-neutral-300 mb-1">End Date & Time</label>

            <ReactDatePicker
  selected={selectedDate}
  onChange={(date) => setSelectedDate(date)}
  showTimeSelect
  timeIntervals={5}
  minDate={minSelectableDate}
  
  minTime={
    selectedDate
      ? selectedDate.toDateString() === minSelectableDate.toDateString()
        ? minSelectableDate
        : new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0,
            0,
            0,
            0
          )
      : minSelectableDate
  }
  maxTime={
    selectedDate
      ? new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          23,
          59,
          0,
          0
        )
      : new Date(
          minSelectableDate.getFullYear(),
          minSelectableDate.getMonth(),
          minSelectableDate.getDate(),
          23,
          59,
          0,
          0
        )
  }

  dateFormat="dd.MM.yyyy HH:mm"
  placeholderText="Select date & time"
  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
/>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-md bg-accentPurple py-2 text-sm font-medium disabled:opacity-40"
          >
            {loading ? "Creating…" : "Create Market"}
          </button>
        </div>

        <div className="text-center text-xs text-neutral-500 pt-4">
          Factory: {FACTORY_ADDRESS}
        </div>
      </div>
    </div>
  );
}