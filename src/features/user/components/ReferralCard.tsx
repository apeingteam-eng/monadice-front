"use client";

import { useEffect, useState } from "react";
import api from "@/config/api";

interface RefResponse {
  status: string;
  ref_code: string;
  ref_link: string;
  ref_count: number;
}

export default function ReferralCard() {
  const [refLink, setRefLink] = useState("");
  const [refCode, setRefCode] = useState("");
  const [refCount, setRefCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [copiedField, setCopiedField] = useState<"link" | "code" | null>(null);

  useEffect(() => {
    async function loadRef() {
      try {
        const res = await api.get<RefResponse>("/auth/my-ref-link");
        setRefLink(res.data.ref_link);
        setRefCode(res.data.ref_code);
        setRefCount(res.data.ref_count);
      } catch (err) {
        console.error("Failed to load referral link:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRef();
  }, []);

  const copy = async (text: string, type: "link" | "code") => {
    await navigator.clipboard.writeText(text);
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const shareOnX = () => {
    const message = encodeURIComponent(
      `I’m betting on @Monadice — come bet with me!\n\nJoin with my link:\n${refLink}`
    );
    const url = `https://twitter.com/intent/tweet?text=${message}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-neutral-400">
        Loading referral data...
      </div>
    );
  }

  return (
    <div className="
      rounded-xl border border-accentPurple/40 bg-neutral-900 p-5 relative overflow-hidden
      shadow-[0_0_20px_rgba(155,93,229,0.25)]
    ">
      {/* Glow BG */}
      <div className="absolute inset-0 bg-gradient-to-br from-accentPurple/30 via-[#8a4ae4]/20 to-transparent blur-2xl opacity-60" />

      <div className="relative z-10 space-y-4">

        <h3 className="text-base font-semibold text-neutral-200">
          Your Referral Link
        </h3>

        {/* ============================ REF LINK ============================ */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-neutral-800/60 border border-neutral-700 rounded-md px-3 py-3 text-sm truncate">
            {refLink}
          </div>

          <button
            onClick={() => copy(refLink, "link")}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-all
              ${copiedField === "link"
                ? "bg-accentPurple text-white"
                : "bg-white text-black"}
            `}
          >
            Copy
          </button>
        </div>

        {/* ============================ REF CODE ============================ */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-neutral-800/60 border border-neutral-700 rounded-md px-3 py-3 text-sm">
            {refCode}
          </div>

          <button
            onClick={() => copy(refCode, "code")}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-all
              ${copiedField === "code"
                ? "bg-accentPurple text-white"
                : "bg-white text-black"}
            `}
          >
            Copy
          </button>
        </div>

        {/* ============================ SHARE ON X ============================ */}
        <button
          onClick={shareOnX}
          className="
            w-full mt-2 py-2 rounded-md
            bg-gradient-to-r from-[#A46CFF] via-accentPurple to-[#8A5DFF]
            text-white font-semibold
            shadow-[0_0_20px_rgba(155,93,229,0.45)]
            hover:shadow-[0_0_35px_rgba(155,93,229,0.8)]
            transition-all
          "
        >
          Share on X
        </button>

        {/* ============================ REF COUNT ============================ */}
        <p className="text-xs text-neutral-400 text-center mt-1">
          Referrals: <span className="text-accentPurple font-semibold">{refCount}</span>
        </p>
      </div>
    </div>
  );
}