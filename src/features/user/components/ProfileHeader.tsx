// src/features/user/components/ProfileHeader.tsx
interface ProfileHeaderProps {
  username: string;
  walletAddress: string;
}

export default function ProfileHeader({ username, walletAddress }: ProfileHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-[2px] rounded-full bg-gradient-to-br from-accentPurple to-[#7a4edb]">
          <div className="h-12 w-12 rounded-full bg-neutral-900 border border-neutral-800 grid place-items-center">
            <span className="text-neutral-400 text-xs">IMG</span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{username}</h1>
          <span className="inline-flex items-center gap-2 mt-1 px-2 py-0.5 rounded-md border border-neutral-800 bg-neutral-900 text-xs text-neutral-300">
            <span className="h-2 w-2 rounded-full bg-accentPurple" />
            {walletAddress}
          </span>
        </div>
      </div>
      <button className="rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-3 py-2 text-xs font-medium">
        Edit Profile
      </button>
    </div>
  );
}
