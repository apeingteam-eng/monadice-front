"use client";

import CreateMarketWithApproval from "@/components/CreateMarketWithApproval";

export default function CreateMarketPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white py-12 px-4">
      <div className="container mx-auto max-w-2xl space-y-8">
        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accentPurple to-[#7a4edb] bg-clip-text text-transparent">
            Create a New Market
          </h1>
          <p className="text-neutral-400 text-sm">
            Set up your prediction market by entering a title, symbol, and duration.  
            A small fee of <span className="text-accentPurple font-medium">1 USDC</span> will be charged to create.
          </p>
        </div>

        {/* FORM CARD */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md p-6 shadow-lg">
          <CreateMarketWithApproval />
        </div>

        {/* INFO FOOTER */}
        <div className="text-center text-xs text-neutral-500 pt-4 border-t border-neutral-800">
          Powered by Monadice Factory Contract  
          <br />
          <span className="text-neutral-600">
            Contract: 0xED7cd209EcA8060e61Bdc2B3a3Ec895b42c6a2B6
          </span>
        </div>
      </div>
    </div>
  );
}
