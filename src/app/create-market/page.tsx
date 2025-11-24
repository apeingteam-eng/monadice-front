"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import type { Eip1193Provider } from "ethers";
import type { LogDescription } from "ethers";
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
/* ------------------------------------------------------------
   CUSTOM DROPDOWN COMPONENT (Monadice Styled)
------------------------------------------------------------ */
function CustomDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {/* Selected box */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          w-full px-3 py-2 rounded-md
          bg-neutral-900/60 border border-neutral-700/50
          text-neutral-200 text-left
          focus:border-accentPurple focus:ring-1 focus:ring-accentPurple
          outline-none transition
          flex justify-between items-center
        "
      >
        {value}
        <span className="text-neutral-500">▼</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="
            absolute left-0 right-0 mt-2
            bg-neutral-900/90 backdrop-blur-xl
            border border-neutral-700/50
            rounded-lg shadow-xl z-20
          "
        >
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="
                px-3 py-2 cursor-pointer
                text-neutral-200
                hover:bg-accentPurple/20 transition
              "
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default function CreateMarketPage() {
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("CRYPTO");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
const accessToken = typeof window !== "undefined"
  ? localStorage.getItem("access_token")
  : null;
  const [signer, setSigner] = useState<Signer | null>(null);
  const [, setAllowanceEnough] = useState(false); // intentionally unused
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [buttonStage, setButtonStage] = useState<"verify" | "approve" | "create">("verify");
  const minSelectableDate = addMinutes(new Date(), 10);
const [participantA, setParticipantA] = useState("");
const [participantB, setParticipantB] = useState("");
const [sportOutcome, setSportOutcome] = useState<"beat" | "draw" | "score">("beat");
const [scoreA, setScoreA] = useState("");
const [scoreB, setScoreB] = useState("");
const [draftNonce, setDraftNonce] = useState<number | null>(null);
useEffect(() => {
  const saved = localStorage.getItem("draft_nonce");
  if (saved) setDraftNonce(Number(saved));
}, []);
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
  if (!accessToken) return toast.error("Please log in to create a market.");
  if (!selectedDate) return toast.error("Select an end date.");
  if (!address) return toast.error("Connect your wallet.");
    // 🚫 Skip verification for POLITICS & SOCIAL
    if (category === "POLITICS" || category === "SOCIAL") {
      setVerified(true);
      setButtonStage("approve");
      toast.success("No verification required for this category ✔");
      return;
    }
  setLoading(true);

  try {
    let body;
    let url;

    if (category === "SPORTS") {
      if (!participantA.trim()) return toast.error("Enter name for Participant A.");
      if (!participantB.trim()) return toast.error("Enter name for Participant B.");

let outcomeForAPI: string = sportOutcome;
      if (sportOutcome === "score") {
        outcomeForAPI = `${scoreA}-${scoreB}`;
      }

      body = {
        team_a: participantA,
        team_b: participantB,
        outcome: outcomeForAPI,
        user_wallet: address,
        end_time: selectedDate.toISOString(),
      };

      url = `${process.env.NEXT_PUBLIC_API_URL}/verify-sports-campaign/`;
    } 
    else {
      // CRYPTO, POLITICS, SOCIAL (existing)
      if (category !== "SPORTS" && !title.trim()) {
  return toast.error("Enter a market title.");
}

      body = {
        title,
        end_time: selectedDate.toISOString(),
        user_wallet: address,
        category: category.toLowerCase(),
      };

      url = `${process.env.NEXT_PUBLIC_API_URL}/verify-campaign/`;
    }

    toast.info("Verifying market…");
    const res = await fetch(url, {
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

// store nonce
if (data.draft_nonce !== undefined) {
  setDraftNonce(data.draft_nonce);
  localStorage.setItem("draft_nonce", String(data.draft_nonce));
}

setVerified(true);
setButtonStage("approve");
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
      setButtonStage("create");
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
    toast.info("Waiting for confirmations…");

    const receipt = await tx.wait(2);

   let campaignAddress: string | null = null;

for (const log of receipt.logs) {
  if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;

  let parsed: LogDescription | null = null;
  try {
    parsed = factory.interface.parseLog(log);
  } catch {
    parsed = null;
  }

  if (parsed && parsed.name === "CampaignDeployed") {
  campaignAddress = parsed.args[2];
  break;
}
}

    if (!campaignAddress) {
      return toast.error("Could not extract campaign address.");
    }

    toast.success(`Market deployed: ${campaignAddress}`);

    // --- Poll backend for event ---
    toast.info("Waiting for backend sync…");

    let synced = false;
    for (let i = 0; i < 8; i++) {
      const syncRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/sync`);
      if (syncRes.ok) {
        synced = true;
        break;
      }
      await new Promise(res => setTimeout(res, 1200));
    }

    synced ? toast.success("Backend synced!") : toast.error("Backend sync failed.");

    // --- Award points ---
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/points/createUserPoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_wallet: address,
          campaign_address: campaignAddress,
        }),
      });

      toast.success("Points granted!");
    } catch (err) {
      console.error(err);
      toast.error("Points failed.");
    }
// --- Attach Draft to Campaign ---
if (draftNonce !== null) {
  try {
    const attachRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/attach-draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // 🔥 ADD THIS
      },
      body: JSON.stringify({
        campaign_address: campaignAddress,
        draft_nonce: draftNonce,
      }),
    });

    if (!attachRes.ok) {
      const errData = await attachRes.json();
      console.log("Attach error:", errData);
      toast.error(errData.detail || "Draft attach failed.");
    } else {
      toast.success("Draft attached to campaign ✔");
    }
  } catch (err) {
    console.error("Attach draft error:", err);
    toast.error("Could not attach draft.");
  }
}
  } catch (err) {
    console.error(err);
    toast.error("Create failed.");
  } finally {
    setLoading(false);
  }
};/* --------------------------------- UI ----------------------------------- */
return (
  <div className="relative min-h-screen w-full overflow-hidden text-white">
    {/* Background video */}
    <video
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover z-0"
    >
      <source src="/monadice_coin_create.mp4" type="video/mp4" />
    </video>

    {/* Black overlay */}
    <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] z-0"></div>

    {/* Main content */}
    <div className="relative z-10 py-12 px-4">
      <div className="container mx-auto max-w-xl space-y-8">

        {/* Title */}
        <h1 className="text-4xl font-bold text-center 
            bg-gradient-to-r from-accentPurple to-[#7a4edb]
            bg-clip-text text-transparent
            drop-shadow-[0_0_12px_rgba(155,93,229,0.6)]
        ">
          Create a New Market
        </h1>

        {/* Card */}
        <div className="space-y-6 p-7 rounded-2xl 
            border border-white/10 
            bg-white/5 backdrop-blur-xl 
            shadow-[0_0_25px_rgba(0,0,0,0.4)]
            ">
          
          {/* Market Title */}
          {category !== "SPORTS" && (
  <div className="space-y-1">
    <label className="text-sm text-neutral-300">Market Title</label>
    <input
      value={title}
      onChange={(e) => {
        setTitle(e.target.value);
        setVerified(null);
        setButtonStage("verify");
      }}
      placeholder="e.g. BTC above 100K?"
      className="
        w-full px-3 py-2
        rounded-md 
        bg-neutral-900/60 
        border border-neutral-700/50
        focus:border-accentPurple
        focus:ring-1 focus:ring-accentPurple
        outline-none transition
      "
    />
  </div>
)}

          {/* SPORTS MODE FIELDS */}
          {category === "SPORTS" && (
            <div className="space-y-4">

              {/* Participant A */}
              <div className="space-y-1">
                <label className="text-sm text-neutral-300">Participant A</label>
                <input
                  value={participantA}
                  onChange={(e) => {
                    setParticipantA(e.target.value);
                    setVerified(null);
                    setButtonStage("verify");
                  }}
                  placeholder="e.g. Barcelona, UFC Fighter"
                  className="
                    w-full px-3 py-2
                    rounded-md 
                    bg-neutral-900/60 
                    border border-neutral-700/50
                    focus:border-accentPurple
                    focus:ring-1 focus:ring-accentPurple
                    outline-none transition
                  "
                />
              </div>

              {/* Participant B */}
              <div className="space-y-1">
                <label className="text-sm text-neutral-300">Participant B</label>
                <input
                  value={participantB}
                  onChange={(e) => {
                    setParticipantB(e.target.value);
                    setVerified(null);
                    setButtonStage("verify");
                  }}
                  placeholder="e.g. Chelsea, UFC Fighter"
                  className="
                    w-full px-3 py-2
                    rounded-md 
                    bg-neutral-900/60 
                    border border-neutral-700/50
                    focus:border-accentPurple
                    focus:ring-1 focus:ring-accentPurple
                    outline-none transition
                  "
                />
              </div>

              {/* Outcome Selection */}
              {/* Outcome Selection */}
<div className="space-y-1">
  <label className="text-sm text-neutral-300">Outcome</label>

  <CustomDropdown
    value={sportOutcome}
    onChange={(v) => {
      setSportOutcome(v as "beat" | "draw" | "score");
      setVerified(null);
      setButtonStage("verify");
    }}
    options={["beat", "draw", "score"]}
  />
</div>

              {/* Score Inputs */}
              {sportOutcome === "score" && (
                <div className="flex gap-3">
                  <div className="w-1/2">
                    <label className="text-sm text-neutral-300">Score A</label>
                    <input
                      type="number"
                      value={scoreA}
                      onChange={(e) => setScoreA(e.target.value)}
                      placeholder="0"
                      className="
                        w-full px-3 py-2
                        rounded-md 
                        bg-neutral-900/60 
                        border border-neutral-700/50
                        focus:border-accentPurple
                        focus:ring-1 focus:ring-accentPurple
                        outline-none transition
                      "
                    />
                  </div>

                  <div className="w-1/2">
                    <label className="text-sm text-neutral-300">Score B</label>
                    <input
                      type="number"
                      value={scoreB}
                      onChange={(e) => setScoreB(e.target.value)}
                      placeholder="0"
                      className="
                        w-full px-3 py-2
                        rounded-md 
                        bg-neutral-900/60 
                        border border-neutral-700/50
                        focus:border-accentPurple
                        focus:ring-1 focus:ring-accentPurple
                        outline-none transition
                      "
                    />
                  </div>
                </div>
              )}
            </div>
          )}

         {/* Category */}
<div className="space-y-1">
  <label className="text-sm text-neutral-300">Category</label>

  <CustomDropdown
    value={category}
    onChange={(v) => {
  setCategory(v);

  // reset verification only for categories that require verification
  if (v === "CRYPTO" || v === "SPORTS") {
    setVerified(null);
    setButtonStage("verify");
  } else {
    // POLITICS / SOCIAL → skip verify step
    setVerified(true);
    setButtonStage("approve");
  }
}}
    options={["CRYPTO", "SPORTS", "POLITICS", "SOCIAL"]}
  />
</div>
{/* End Date */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <label className="text-sm text-neutral-300 whitespace-nowrap sm:w-40">
    End Date & Time
  </label>

  <ReactDatePicker
  selected={selectedDate}
  onChange={(d) => {
    setSelectedDate(d);
    setVerified(null);
    setButtonStage("verify");
  }}
  showTimeSelect
  timeIntervals={5}
  dateFormat="dd.MM.yyyy HH:mm"
  minDate={minSelectableDate}
  minTime={
    selectedDate &&
    selectedDate.toDateString() === minSelectableDate.toDateString()
      ? minSelectableDate               // today → restrict to current time
      : new Date(0, 0, 0, 0, 0, 0)      // other days → allow full 00:00+
  }
  maxTime={new Date(0, 0, 0, 23, 59, 59)}
  className="
    w-full px-3 py-2
    rounded-md
    bg-neutral-900/60 
    border border-neutral-700/50
    focus:border-accentPurple
    focus:ring-1 focus:ring-accentPurple
    outline-none transition
  "
  calendarClassName="!bg-neutral-900 !text-white !border-neutral-700"
/>
</div>

          <button
            onClick={() => {
              if (buttonStage === "verify") return handleVerify();
              if (buttonStage === "approve") return handleApprove();
              if (buttonStage === "create") return handleCreateMarket();
            }}
            disabled={loading}
            className="
              relative w-full py-3 mt-4 rounded-xl font-semibold
              bg-gradient-to-r from-[#A46CFF] via-accentPurple to-[#8A5DFF]
              text-white overflow-hidden transition-all
              shadow-[0_0_25px_rgba(155,93,229,0.45)]
              hover:shadow-[0_0_40px_rgba(155,93,229,0.8)]
              hover:scale-[1.01] active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            {loading
              ? buttonStage === "verify"
                ? "Verifying…"
                : buttonStage === "approve"
                ? "Approving…"
                : "Creating…"
              : buttonStage === "verify"
              ? "Verify Market"
              : buttonStage === "approve"
              ? "Approve 1 USDC"
              : "Create Market"}
          </button>

        </div>
      </div>
    </div>
  </div>
);
}