"use client";

import { useState, useEffect } from "react";
import { createUser } from "@/features/wallet/utils/authService";

interface CreateUserModalProps {
  walletAddress: string;
  onSuccess: (token: string) => void;
  onClose: () => void;
}

export default function CreateUserModal({
  walletAddress,
  onSuccess,
  onClose,
}: CreateUserModalProps) {
  const [username, setUsername] = useState("");
  const [refCode, setRefCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill referral code if exists
  useEffect(() => {
    const saved = localStorage.getItem("referral_code");
    if (saved) setRefCode(saved);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setLoading(true);
      setError(null);

      // Send username + auto referral
      const res = await createUser(walletAddress, username);

      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("wallet_address", walletAddress);
      localStorage.removeItem("referral_code");

      onSuccess(res.access_token);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message :
        typeof err === "string" ? err :
        "Failed to create profile";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">

      {/* MODAL WRAPPER */}
      <div
        className="
          bg-neutral-900/95 
          relative p-7 
          rounded-2xl 
          w-full max-w-sm 
          border border-neutral-700 
          shadow-[0_0_35px_rgba(155,93,229,0.35)]
          overflow-hidden
        "
      >

        {/* BACKGROUND GLOW */}
        <div className="
          absolute inset-0 
          bg-gradient-to-br 
          from-accentPurple/20 
          via-transparent 
          to-transparent 
          blur-2xl opacity-40
        " />

        {/* CONTENT LAYER */}
        <div className="relative z-10">

          {/* TITLE */}
          <h2 className="text-2xl font-semibold text-accentPurple mb-4">
            Complete your profile
          </h2>

          {/* WALLET DISPLAY */}
          <div className="mb-5">
            <p className="text-sm text-neutral-400">Connected wallet</p>
            <p className="text-white font-mono text-xs break-all mt-1 opacity-90">
              {walletAddress}
            </p>
          </div>

          {/* DECORATIVE DIVIDER */}
          <div className="h-px w-full bg-neutral-800 mb-5" />

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* USERNAME INPUT */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-300 tracking-wide">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a username"
                className="
                  w-full rounded-lg 
                  border border-neutral-700 
                  bg-neutral-800 
                  px-3 py-2 text-sm 
                  focus:outline-none 
                  focus:border-accentPurple/80
                  focus:ring-2 
                  focus:ring-accentPurple/40 
                  transition-all
                "
              />
            </div>

            {/* REFERRAL CODE INPUT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-300 tracking-wide">
                  Referral code
                </label>

                {/* OPTIONAL BADGE IF EXISTS */}
                {refCode && (
                  <span
                    className="
                      text-[10px] 
                      px-2 py-[1px] 
                      rounded-full 
                      bg-accentPurple/20 
                      text-accentPurple 
                      border border-accentPurple/40
                      animate-pulse
                    "
                  >
                    Auto-detected
                  </span>
                )}
              </div>

              <input
                type="text"
                value={refCode ?? ""}
                onChange={(e) => setRefCode(e.target.value || null)}
                placeholder="Referral code (optional)"
                className="
                  w-full rounded-lg 
                  border border-accentPurple/40 
                  bg-neutral-800 
                  px-3 py-2 text-sm 
                  focus:outline-none 
                  focus:ring-2 
                  focus:ring-accentPurple 
                  transition-all
                "
              />
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <p className="text-red-500 text-sm pt-1">{error}</p>
            )}

            {/* BUTTON ROW */}
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-200 text-sm transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !username}
                className="
                  bg-accentPurple 
                  hover:bg-accentPurple/90 
                  disabled:opacity-50 
                  disabled:cursor-not-allowed
                  text-white 
                  px-5 py-2 
                  rounded-md 
                  text-sm 
                  transition-all 
                  shadow-[0_0_10px_rgba(155,93,229,0.5)]
                "
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}