"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { BrowserProvider, Contract, JsonRpcSigner } from "ethers";
import type { Eip1193Provider } from "ethers";

import { BetMarketFactoryABI, ERC20ABI } from "@/lib/ethers/abi";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const FACTORY_ADDRESS = "0xED7cd209EcA8060e61Bdc2B3a3Ec895b42c6a2B6";

const USDC_DECIMALS = 6;
const REQUIRED_USDC = 1n * 10n ** BigInt(USDC_DECIMALS);
const TARGET_CHAIN_ID = 84532;

export default function CreateMarketTwoStep() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [allowanceEnough, setAllowanceEnough] = useState(false);

  // Inputs
  const [name, setName] = useState("");
  const [category, setCategory] = useState("CRYPTO");
  const [endTime, setEndTime] = useState("");
  const [minEndTime, setMinEndTime] = useState("");

  // Verification state
  const [verifiedDraft, setVerifiedDraft] = useState<boolean | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  /* ----------------------------- SIGNER SETUP ----------------------------- */
  useEffect(() => {
    async function setup() {
      if (!walletClient || !address) return setSigner(null);

      const provider = new BrowserProvider(
        walletClient.transport as Eip1193Provider
      );

      const s = await provider.getSigner(address);
      setSigner(s);
    }
    setup();
  }, [walletClient, address]);

  /* -------------------------- CHECK USDC ALLOWANCE ------------------------ */
  useEffect(() => {
    async function checkAllowance() {
      if (!signer || !address) return;

      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer);
      const allowance: bigint = await usdc.allowance(address, FACTORY_ADDRESS);

      setAllowanceEnough(allowance >= REQUIRED_USDC);
    }

    checkAllowance();
  }, [signer, address]);

  /* --------------------------- MIN END TIME SETUP ---------------------------- */
  useEffect(() => {
    function computeMinEndTime() {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 10);

      const rounded = new Date(now);
      const roundedMinutes = Math.ceil(rounded.getMinutes() / 5) * 5;
      rounded.setMinutes(roundedMinutes, 0, 0);

      const year = rounded.getFullYear();
      const month = String(rounded.getMonth() + 1).padStart(2, "0");
      const day = String(rounded.getDate()).padStart(2, "0");
      const hours = String(rounded.getHours()).padStart(2, "0");
      const minutes = String(rounded.getMinutes()).padStart(2, "0");

      const localStr = `${year}-${month}-${day}T${hours}:${minutes}`;
      setMinEndTime(localStr);
    }

    computeMinEndTime();
    const interval = setInterval(computeMinEndTime, 15000);
    return () => clearInterval(interval);
  }, []);

  /* --------------------------- VERIFY CAMPAIGN ---------------------------- */
  const handleVerifyDraft = async () => {
    setError(null);
    setStatus(null);
    setVerifiedDraft(null);

    // ✅ Do validation *before* setting loading
    if (!name.trim()) {
      setError("Market name required.");
      return;
    }
    if (!endTime) {
      setError("End time required.");
      return;
    }
    if (!category) {
      setError("Category required.");
      return;
    }
    if (!address) {
      setError("Wallet required.");
      return;
    }

    setLoading(true);
    setStatus("Verifying campaign…");

    try {
      const body = {
        title: name,
        end_time: new Date(endTime).toISOString(),
        user_wallet: address,
        category: category.toLowerCase(),
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/verify-campaign/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setStatus(null);
        setError(data.message || "Verification failed.");
        return;
      }

      setVerifiedDraft(data.verified);

      if (data.verified) {
        setStatus("Draft verified ✔ You may deploy your market.");
      } else {
        setError(data.message || "Statement not measurable.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification error.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------- APPROVE LOGIC ----------------------------- */
  const handleApprove = async () => {
    if (!signer) {
      setError("Wallet not ready.");
      return;
    }

    setError(null);
    setStatus("Approving USDC…");
    setLoading(true);

    try {
      const usdc = new Contract(USDC_ADDRESS, ERC20ABI, signer);

      const tx = await usdc.approve(FACTORY_ADDRESS, REQUIRED_USDC);
      await tx.wait();

      setStatus("USDC approved!");
      setAllowanceEnough(true);
    } catch {
      setError("Approve failed.");
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------- CREATE CAMPAIGN ---------------------------- */
  const handleCreateMarket = async () => {
    setError(null);
    setStatus(null);
    setTxHash(null);

    if (!verifiedDraft) {
      return setError("You must verify the campaign first.");
    }

    if (!signer) return setError("Wallet not ready.");
    if (!address) return setError("Wallet not connected.");
    if (chainId !== TARGET_CHAIN_ID)
      return setError("Wrong network. Switch to Base Sepolia.");

    setLoading(true);

    try {
      const unixEnd = Math.floor(new Date(endTime).getTime() / 1000);
      const factory = new Contract(FACTORY_ADDRESS, BetMarketFactoryABI, signer);

      setStatus("Creating market…");
      const tx = await factory.createCampaign(name, category, unixEnd, 200);

      setStatus("Waiting for confirmation…");
      const receipt = await tx.wait();
      setTxHash(receipt.hash);

      setStatus("Market created!");

      // BACKEND SYNC
      setStatus("Syncing backend…");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/sync`);
      if (!res.ok) {
        setStatus("Market created but backend sync failed.");
      } else {
        setStatus("Backend synced successfully!");
      }
    } catch {
      setError("Create failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------- UI ------------------------------------ */
  return (
    <form className="space-y-5 p-6 bg-neutral-900 border border-neutral-800 rounded-xl">
      <h2 className="text-white text-lg font-semibold">Create Market</h2>

      {/* Name */}
      <div>
        <label className="text-neutral-400 text-sm">Market Name</label>
        <input
          className="w-full mt-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-neutral-400 text-sm">Category</label>
        <select
          className="w-full mt-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {["CRYPTO", "SPORTS", "POLITICS", "SOCIAL"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* End time */}
      <div>
        <label className="text-neutral-400 text-sm">End Time</label>
        <input
          type="datetime-local"
          className="w-full mt-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md"
          value={endTime}
          min={minEndTime || undefined}
          onFocus={(e) => {
            if (minEndTime) {
              e.target.min = minEndTime;
            }
          }}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) {
              setEndTime("");
              return;
            }

            const selected = new Date(value);

            const now = new Date();
            now.setMinutes(now.getMinutes() + 10);

            const rounded = new Date(now);
            const roundedMinutes = Math.ceil(rounded.getMinutes() / 5) * 5;
            rounded.setMinutes(roundedMinutes, 0, 0);

            if (selected < rounded) {
              const year = rounded.getFullYear();
              const month = String(rounded.getMonth() + 1).padStart(2, "0");
              const day = String(rounded.getDate()).padStart(2, "0");
              const hours = String(rounded.getHours()).padStart(2, "0");
              const minutes = String(rounded.getMinutes()).padStart(2, "0");
              const corrected = `${year}-${month}-${day}T${hours}:${minutes}`;

              setError("End time automatically corrected to the nearest valid time.");
              setEndTime(corrected);
              e.target.value = corrected;
              return;
            }

            setError(null);
            setEndTime(value);
          }}
        />
      </div>

      {/* Verify button */}
      <button
        type="button"
        onClick={handleVerifyDraft}
        disabled={loading}
        className="w-full bg-blue-600 py-2 rounded-md text-white disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Verify Market"}
      </button>

      {/* Approval & Create buttons */}
      {verifiedDraft && !allowanceEnough && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={loading}
          className="w-full bg-purple-600 py-2 rounded-md text-white disabled:opacity-50"
        >
          {loading ? "Approving…" : "Approve 1 USDC"}
        </button>
      )}

      {verifiedDraft && allowanceEnough && (
        <button
          type="button"
          onClick={handleCreateMarket}
          disabled={loading}
          className="w-full bg-accentPurple py-2 rounded-md text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Market"}
        </button>
      )}

      {status && <p className="text-neutral-300">{status}</p>}
      {error && <p className="text-red-500">{error}</p>}

      {txHash && (
        <a
          className="underline text-accentPurple"
          target="_blank"
          href={`https://sepolia.basescan.org/tx/${txHash}`}
        >
          View Transaction →
        </a>
      )}
    </form>
  );
}