"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import type { Eip1193Provider, Signer } from "ethers";
import type { LogDescription } from "ethers";
import ReactDatePicker from "react-datepicker";
import { addMinutes } from "date-fns";

import BlitzMarketFactoryABI from "@/lib/ethers/abi/BlitzMarketFactory.json";
import { CHAIN } from "@/config/network";
import { useToast } from "@/components/toast/ToastContext";

/* ------------------------------------------------------------
   ICONS
------------------------------------------------------------ */
const IconInfo = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;
const IconCalendar = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;
const IconLock = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
const IconGlobe = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;

/* ------------------------------------------------------------
   CONSTANTS
------------------------------------------------------------ */
const FACTORY_ADDRESS = CHAIN.addresses.BLITZ_FACTORY;
const TARGET_CHAIN_ID = CHAIN.chainId;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/* ------------------------------------------------------------
   MAIN COMPONENT
------------------------------------------------------------ */
type Props = {
  onSuccess?: () => void;
};

export default function CreateBlitzMarket({ onSuccess }: Props) {
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  type ViewMode = "guide" | "create";
  const [viewMode, setViewMode] = useState<ViewMode>("guide");
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const [signer, setSigner] = useState<Signer | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---------------- MARKET CORE ---------------- */
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  /* ---------------- OUTCOMES ---------------- */
  // We manage dynamic outcomes now
  const [outcomeNames, setOutcomeNames] = useState<string[]>(["", ""]);

  /* ---------------- WHITELIST ---------------- */
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [whitelistWallets, setWhitelistWallets] = useState<string[]>([]);
  const [whitelistInput, setWhitelistInput] = useState("");

  const addWhitelistAddress = () => {
    const addr = whitelistInput.trim();
    if (!addr) return;
    // Simple regex or ethers.isAddress check
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return toast.error("Invalid address format");
    }
    if (whitelistWallets.includes(addr)) {
      setWhitelistInput("");
      return; // No dupes
    }
    setWhitelistWallets([...whitelistWallets, addr]);
    setWhitelistInput("");
  };

  const removeWhitelistAddress = (idx: number) => {
    setWhitelistWallets(whitelistWallets.filter((_, i) => i !== idx));
  };

  const minSelectableDate = addMinutes(new Date(), 10);

  /* ------------------------------------------------------------
     SIGNER SETUP
  ------------------------------------------------------------ */
  useEffect(() => {
    async function setup() {
      if (!walletClient || !address) return;
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const s = await provider.getSigner(address);
      setSigner(s);
    }
    setup();
  }, [walletClient, address]);

  /* ------------------------------------------------------------
     HELPERS
  ------------------------------------------------------------ */
  const addOutcome = () => {
    if (outcomeNames.length >= 8) return toast.error("Max 8 outcomes allowed");
    setOutcomeNames([...outcomeNames, ""]);
  };

  const removeOutcome = (idx: number) => {
    if (outcomeNames.length <= 2) return toast.error("Min 2 outcomes required");
    setOutcomeNames(outcomeNames.filter((_, i) => i !== idx));
  };

  const updateOutcome = (idx: number, val: string) => {
    const next = [...outcomeNames];
    next[idx] = val;
    setOutcomeNames(next);
  };

  /* ------------------------------------------------------------
     CREATE MARKET
  ------------------------------------------------------------ */
  const handleCreateMarket = async () => {
    if (!accessToken) return toast.error("Please log in.");
    if (!address) return toast.error("Connect your wallet.");
    if (!signer) return toast.error("Wallet not ready.");
    if (chainId !== TARGET_CHAIN_ID) return toast.error(`Switch to ${CHAIN.name}.`);

    if (!title.trim()) return toast.error("Market title is required.");
    if (!selectedDate) return toast.error("End date is required.");

    if (outcomeNames.some((o) => !o.trim())) {
      return toast.error("All outcome names must be filled.");
    }
    const outcomeCount = outcomeNames.length;

    const cleanedWhitelist = whitelistWallets.map((w) => w.trim()).filter(Boolean);
    // Removed validation: User can create private market with empty whitelist and add later.

    try {
      setLoading(true);
      toast.info("Deploying Blitz market…");

      const endUnix = Math.floor(selectedDate.getTime() / 1000);

      /* ---------------- ON-CHAIN ---------------- */
      const factory = new Contract(FACTORY_ADDRESS, BlitzMarketFactoryABI, signer);

      const tx = await factory.createCampaign(
        title,          // name
        "BLITZ",        // symbol
        ZERO_ADDRESS,   // native MON
        outcomeCount,
        endUnix,
        isWhitelisted   // permissioned
      );

      const receipt = await tx.wait(2);
      let campaignAddress: string | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;
        try {
          const parsed: LogDescription = factory.interface.parseLog(log);
          if (parsed.name === "CampaignDeployed") {
            campaignAddress = parsed.args[2];
            break;
          }
        } catch { }
      }

      if (!campaignAddress) {
        toast.error("Failed to read campaign address.");
        return;
      }

      // console.log("Deployed Campaign:", campaignAddress);
      toast.success("Market deployed on-chain.");

      /* ---------------- BACKEND API ---------------- */
      toast.info("Saving market to backend…");
      const createRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/blitz/create?campaign_address=${campaignAddress}&name=${encodeURIComponent(title)}&symbol=BLITZ&bet_token=${ZERO_ADDRESS}&outcome_count=${outcomeCount}&permissioned=${isWhitelisted}&end_time=${endUnix}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(outcomeNames),
        }
      );

      if (!createRes.ok) throw new Error("Backend save failed");

      /* ---------------- WHITELIST ---------------- */
      if (isWhitelisted && cleanedWhitelist.length > 0) {
        toast.info("Adding whitelist...");
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/blitz/whitelist/add`, { // Removed query param
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            campaign_address: campaignAddress,
            users: cleanedWhitelist
          })
        });

        // Dynamic import to avoid build errors if ABI missing at top initially
        const BlitzBetCampaignABI = await import("@/lib/ethers/abi/BlitzBetCampaign.json").then(m => m.default);
        const campaignContract = new Contract(campaignAddress, BlitzBetCampaignABI, signer);
        const wlTx = await campaignContract.addToWhitelist(cleanedWhitelist);
        await wlTx.wait();
        toast.success("Whitelist on-chain updated.");
      }

      toast.success("Blitz market created successfully!");

      // Reset
      setTitle("");
      setSelectedDate(null);
      setOutcomeNames(["", ""]);
      setWhitelistWallets([]);
      setIsWhitelisted(false);

      if (onSuccess) onSuccess();

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Create failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------
    UI COMPONENTS
  ------------------------------------------------------------ */
  return (
    <div className="w-full mx-auto font-sans">

      {/* CARD CONTAINER (Borderless & Integrated) */}
      <div className="relative w-full overflow-hidden">

        {/* TABS HEADER - Big & Visible */}
        <div className="flex items-center justify-center gap-6 mb-12">
          <button
            onClick={() => setViewMode("guide")}
            className={`px-6 py-2 rounded-full text-sm font-bold tracking-wide transition-all duration-300 ${viewMode === "guide" ? "bg-neutral-800 text-white shadow-lg scale-105 border border-neutral-700" : "text-neutral-500 hover:text-neutral-300 bg-transparent"}`}
          >
            How it Works
          </button>

          <button
            onClick={() => setViewMode("create")}
            className={`px-6 py-2 rounded-full text-sm font-bold tracking-wide transition-all duration-300 ${viewMode === "create" ? "bg-accentPurple text-white shadow-lg shadow-accentPurple/25 scale-105" : "text-neutral-500 hover:text-neutral-300 bg-transparent"}`}
          >
            + Create Market
          </button>
        </div>

        <div className="">
          {viewMode === "guide" ? (
            <GuideView onStart={() => setViewMode("create")} />
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto">

              {/* TITLE INPUT */}
              <div className="group">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Market Question (e.g. Will Bitcoin hit $100k by 2025?)"
                  className="w-full px-0 py-3 bg-transparent border-b border-neutral-800 text-xl md:text-2xl font-bold text-white placeholder-neutral-700 focus:border-accentPurple transition-all outline-none text-center"
                />
              </div>

              {/* OUTCOMES & SETTINGS GRID */}
              <div className="grid md:grid-cols-12 gap-8">

                {/* LEFT: OUTCOMES (8 cols) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Outcomes</label>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">{outcomeNames.length} / 8</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {outcomeNames.map((outcome, idx) => (
                      <div key={idx} className="flex gap-2 relative group">
                        <div className="flex items-center justify-center w-8 h-10 rounded-l-lg bg-neutral-800/30 border-y border-l border-neutral-800 text-neutral-500 text-xs font-mono">
                          #{idx + 1}
                        </div>
                        <input
                          value={outcome}
                          onChange={(e) => updateOutcome(idx, e.target.value)}
                          placeholder={`Outcome ${idx + 1}`}
                          className="flex-1 px-3 py-2 rounded-r-lg bg-neutral-900/30 border border-neutral-800 text-white placeholder-neutral-700 focus:border-accentPurple focus:ring-1 focus:ring-accentPurple transition-all outline-none text-sm"
                        />
                        {outcomeNames.length > 2 && (
                          <button
                            onClick={() => removeOutcome(idx)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    ))}

                    {outcomeNames.length < 8 && (
                      <button
                        onClick={addOutcome}
                        className="h-10 border border-dashed border-neutral-800 rounded-lg text-neutral-600 hover:text-accentPurple hover:border-accentPurple/50 hover:bg-accentPurple/5 transition-all flex items-center justify-center gap-2 text-xs font-medium"
                      >
                        <IconPlus /> Add Outcome
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT: SETTINGS (4 cols) */}
                <div className="md:col-span-5 space-y-6">

                  {/* Date Picker */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">End Time</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                        <IconCalendar />
                      </div>
                      <ReactDatePicker
                        selected={selectedDate}
                        onChange={(d) => setSelectedDate(d)}
                        showTimeSelect
                        timeIntervals={15}
                        minDate={minSelectableDate}
                        dateFormat="MMM d, yyyy h:mm aa"
                        placeholderText="Select Deadline"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-neutral-900/30 border border-neutral-800 text-white placeholder-neutral-700 focus:border-accentPurple focus:ring-1 focus:ring-accentPurple transition-all outline-none text-sm"
                        wrapperClassName="w-full"
                      />
                    </div>
                  </div>

                  {/* Whitelist Toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Visibility</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsWhitelisted(false)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${!isWhitelisted ? "bg-neutral-800 text-white border-neutral-700" : "text-neutral-600 border-transparent hover:text-neutral-400"}`}
                        >
                          Public
                        </button>
                        <button
                          onClick={() => setIsWhitelisted(true)}
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${isWhitelisted ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/50" : "text-neutral-600 border-transparent hover:text-neutral-400"}`}
                        >
                          Private
                        </button>
                      </div>
                    </div>

                    {isWhitelisted && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            value={whitelistInput}
                            onChange={(e) => setWhitelistInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addWhitelistAddress()}
                            placeholder="0x..."
                            className="flex-1 px-3 py-2 rounded-lg bg-neutral-900/30 border border-neutral-800 text-white placeholder-neutral-700 text-xs font-mono outline-none focus:border-yellow-500/50 transition-all"
                          />
                          <button
                            onClick={addWhitelistAddress}
                            type="button"
                            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-white text-xs font-bold transition-all border border-neutral-700"
                          >
                            Add
                          </button>
                        </div>

                        {/* Whitelist Queue */}
                        {whitelistWallets.length > 0 && (
                          <div className="max-h-[150px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {whitelistWallets.map((wallet, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-lg group hover:border-neutral-700">
                                <span className="text-[10px] font-mono text-neutral-400">{wallet}</span>
                                <button onClick={() => removeWhitelistAddress(idx)} className="text-neutral-600 hover:text-red-500 transition-colors">
                                  <IconTrash />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-[10px] text-neutral-600 text-right">
                          {whitelistWallets.length} addresses queued
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCreateMarket}
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm shadow-lg bg-gradient-to-r from-accentPurple to-[#a46cff] hover:opacity-90 hover:shadow-accentPurple/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
                    {loading ? "Deploying..." : "Launch Market"}
                  </button>

                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   GUIDE COMPONENT (Horizontal Layout)
------------------------------------------------------------ */
function GuideView({ onStart }: { onStart: () => void }) {
  const steps = [
    { title: "Define", desc: "Set your question & outcomes.", icon: "🎯" },
    { title: "Rules", desc: "Set deadline & visibility.", icon: "⚖️" },
    { title: "Deploy", desc: "Launch on Monad chain.", icon: "🚀" },
    { title: "Resolve", desc: "Pick the winner.", icon: "🏆" },
  ];

  return (
    <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500 py-10">
      <div className="text-center space-y-2">
        <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-neutral-500">
          Create a Blitz Market
        </h2>
        <p className="text-neutral-500 text-sm">
          Decentralized prediction markets, controlled by you.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center text-center p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors gap-3">
            <div className="text-2xl mb-1">{step.icon}</div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
              <p className="text-[10px] text-neutral-500 leading-tight">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="px-10 py-4 rounded-full bg-gradient-to-r from-accentPurple to-[#a46cff] text-white font-bold text-lg shadow-[0_0_20px_rgba(155,93,229,0.3)] hover:shadow-[0_0_30px_rgba(155,93,229,0.5)] hover:scale-105 transition-all transform duration-300"
      >
        Start Creating
      </button>
    </div>
  );
}