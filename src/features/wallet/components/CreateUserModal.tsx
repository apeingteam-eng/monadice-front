"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await createUser(walletAddress, username);

      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("wallet_address", walletAddress);

      onSuccess(res.access_token);
    } catch (err: unknown) {
      // ✅ safe, lint-clean error handling
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Failed to create username";

      console.error("CreateUser error:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 p-6 rounded-xl w-full max-w-sm border border-neutral-700 shadow-xl">
        <h2 className="text-lg font-semibold text-accentPurple mb-2">
          Complete your profile
        </h2>
        <p className="text-sm text-neutral-400 mb-4">
          Connected wallet:{" "}
          <span className="text-white font-mono break-all">{walletAddress}</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accentPurple/50"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username}
              className="bg-accentPurple hover:bg-accentPurple/90 text-white px-4 py-2 rounded-md text-sm"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
