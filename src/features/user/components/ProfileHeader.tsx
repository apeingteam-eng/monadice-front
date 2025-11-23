// src/features/user/components/ProfileHeader.tsx

import Image from "next/image";

interface ProfileHeaderProps {
  username: string;
  walletAddress: string;
}

export default function ProfileHeader({ username, walletAddress }: ProfileHeaderProps) {
  const shortWallet =
    walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-5">

        {/* --- Avatar with Gradient Ring --- */}
        <div className="p-[3px] rounded-full bg-gradient-to-br from-accentPurple to-[#4cc9f0] shadow-[0_0_12px_rgba(155,93,229,0.4)]">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-neutral-900 border border-neutral-800">
            <Image
              src="/PP.png"     // <<--- FIXED!
              alt="Profile"
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* --- Name + Wallet --- */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold leading-tight tracking-wide">
            {username}
          </h1>

          <span className="
            inline-flex items-center gap-2 mt-1 
            px-2 py-0.5 rounded-md 
            border border-neutral-800 bg-neutral-900 
            text-[11px] text-neutral-400
          ">
            <span className="h-1.5 w-1.5 rounded-full bg-accentPurple" />
            {shortWallet}
          </span>
        </div>
      </div>
    </div>
  );
}