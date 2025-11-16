"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import type { Eip1193Provider } from "ethers";

import ReactDatePicker from "react-datepicker";
import { addMinutes } from "date-fns";

import BetMarketFactoryABI from "@/lib/ethers/abi/BetMarketFactory.json";
import { CHAIN } from "@/config/network";
import { useToast } from "@/components/toast/ToastContext";

import type { Signer } from "ethers";

const USDC_ADDRESS = CHAIN.addresses.USDC;
const FACTORY_ADDRESS = CHAIN.addresses.FACTORY;
const USDC_DECIMALS = 6;
const REQUIRED_USDC = BigInt(1 * 10 ** USDC_DECIMALS);
const TARGET_CHAIN_ID = CHAIN.chainId;

export default function CreateMarketPage() {
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CRYPTO");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [signer, setSigner] = useState<Signer | null>(null);
  const [allowanceEnough, setAllowanceEnough] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const minSelectableDate = addMinutes(new Date(), 10);

  /* --------------------------------- SIGNER -------------------------------- */
  useEffect(() => {
    async function setup() {
      if (!walletClient || !address) return setSigner(null);
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const s = await provider.getSigner(address);
      setSigner(s);
    }
    setup();
  }, [walletClient, address]);

  /* ------------------------------ CHECK ALLOWANCE -------------------------- */
  useEffect(() => {
    async function checkAllowance() {
      if (!signer || !address) return;

      const usdc = new Contract(
        USDC_ADDRESS,
        ["function allowance(address owner, address spender) view returns (uint256)"],
        signer
      );

      const allowance: bigint = await usdc.allowance(address, FACTORY_ADDRESS);
      setAllowanceEnough(allowance >= REQUIRED_USDC);
    }
    checkAllowance();
  }, [signer, address]);

  /* ----------------------------- VERIFY CAMPAIGN --------------------------- */
  const handleVerify = async () => {
    if (!title.trim()) return toast.error("Enter a market title.");
    if (!selectedDate) return toast.error("Select an end date.");
    if (!address) return toast.error("Connect your wallet.");

    setLoading(true);

    try {
      toast.info("Verifying market…");
      const body = {
        title,
        end_time: selectedDate.toISOString(),
        user_wallet: address,
        category: category.toLowerCase(),
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/verify-campaign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.verified) {
        toast.error(data.message || "Statement not measurable.");
        setVerified(false);
        return;
      }

      toast.success("Draft verified! ✔");
      setVerified(true);
    } catch {
      toast.error("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------- APPROVE -------------------------------- */
  const handleApprove = async () => {
    if (!signer) return toast.error("Wallet not ready.");

    try {
      setLoading(true);
      toast.info("Approving 1 USDC…");

      const usdc = new Contract(
        USDC_ADDRESS,
        ["function approve(address spender, uint256 amount) returns (bool)"],
        signer
      );

      const tx = await usdc.approve(FACTORY_ADDRESS, REQUIRED_USDC);
      await tx.wait();

      toast.success("USDC approved!");
      setAllowanceEnough(true);
    } catch {
      toast.error("Approval failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------ CREATE MARKET ---------------------------- */
  const handleCreateMarket = async () => {
    if (!verified) return toast.error("Verify your market first.");
    if (!signer) return toast.error("Wallet not ready.");
    if (chainId !== TARGET_CHAIN_ID) return toast.error(`Switch to ${CHAIN.name}.`);
    if (!selectedDate) return toast.error("Date missing.");

    try {
      setLoading(true);
      toast.info("Creating market…");

      const endUnix = Math.floor(selectedDate.getTime() / 1000);
      const factory = new Contract(FACTORY_ADDRESS, BetMarketFactoryABI, signer);

      const tx = await factory.createCampaign(title, category, endUnix, 200);
      await tx.wait();

      toast.success("Market created!");

      toast.info("Syncing backend…");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/sync`);

      toast.success("Backend synced!");
    } catch {
      toast.error("Create failed.");
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------- UI ----------------------------------- */
  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4">
      <div className="container mx-auto max-w-2xl space-y-8">
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-accentPurple to-[#7a4edb] bg-clip-text text-transparent">
          Create a New Market
        </h1>

        <div className="space-y-6 p-6 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
          {/* Title */}
          <div>
            <label className="text-sm text-neutral-300">Market Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm text-neutral-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md"
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
    onChange={setSelectedDate}
    showTimeSelect
    timeIntervals={5}
    dateFormat="dd.MM.yyyy HH:mm"
    minDate={minSelectableDate}
    minTime={
        selectedDate &&
        selectedDate.toDateString() === minSelectableDate.toDateString()
            ? minSelectableDate
            : new Date(selectedDate?.setHours(0, 0, 0, 0) || 0)
    }
maxTime={new Date(new Date().setHours(23, 59, 59, 999))}    className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
/>
          </div>

          {/* Button 1 — VERIFY */}
          <button
            onClick={handleVerify}
            disabled={loading}
            className="w-full py-2 bg-blue-600 rounded-md disabled:opacity-40"
          >
            {loading ? "Verifying…" : "Verify Market"}
          </button>

          {/* Button 2 — APPROVE */}
          {verified && !allowanceEnough && (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="w-full py-2 bg-purple-600 rounded-md disabled:opacity-40"
            >
              {loading ? "Approving…" : "Approve 1 USDC"}
            </button>
          )}

          {/* Button 3 — CREATE */}
          {verified && allowanceEnough && (
            <button
              onClick={handleCreateMarket}
              disabled={loading}
              className="w-full py-2 bg-accentPurple rounded-md disabled:opacity-40"
            >
              {loading ? "Creating…" : "Create Market"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}