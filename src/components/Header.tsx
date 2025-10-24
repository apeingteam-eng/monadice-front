"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/state/store";
import { setSearchQuery } from "@/state/uiSlice";
import { useLogin } from "@/features/wallet/hooks/useLogin";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import CreateUserModal from "@/features/wallet/components/CreateUserModal";
import { useRouter } from "next/navigation";

export default function Header() {
  const dispatch = useDispatch();
  const query = useSelector((s: RootState) => s.ui.searchQuery);
  const router = useRouter();

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { login } = useLogin();

  const [showModal, setShowModal] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [didAuthThisSession, setDidAuthThisSession] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hasToken = useMemo(
    () => typeof window !== "undefined" && !!localStorage.getItem("access_token"),
    []
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!isConnected || !address) return;
      if (hasToken || didAuthThisSession) return;

      const res = await login();
      if (res.status === "pending_username") {
        setPendingWallet(res.walletAddress);
        setShowModal(true);
        setDidAuthThisSession(false);
      } else if (res.status === "success") {
        setDidAuthThisSession(true);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("wallet_address");
    setDidAuthThisSession(false);
    setMenuOpen(false);
    disconnect();
  };

  if (!mounted) return null;

  const profileImage =
    (typeof window !== "undefined" && localStorage.getItem("profile_image")) ||
    "/PP.png";

  return (
    <>
      <header className="w-full sticky top-0 z-40 border-b border-neutral-800/60 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          {/* Brand */}
          {/* Brand */}
<Link href="/" className="flex items-center gap-2">
  <img
    src="/monadiceLogoText.png"
    alt="Monadice"
    className="h-8 w-auto object-contain"
  />
</Link>

          {/* Search */}
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-xl">
              <input
                value={query}
                onChange={(e) => dispatch(setSearchQuery(e.target.value))}
                type="text"
                placeholder="Search markets"
                className="w-full rounded-md border border-neutral-800 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-accentPurple/50 focus:border-accentPurple/50"
              />
            </div>
          </div>

          {/* Right: Wallet & Menu */}
          <div className="ml-auto flex items-center gap-3 relative">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openConnectModal,
                authenticationStatus,
                mounted: buttonMounted,
              }) => {
                const ready = buttonMounted && authenticationStatus !== "loading";
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus || authenticationStatus === "authenticated");

                if (!connected || !account) {
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="rounded-md bg-accentPurple hover:bg-accentPurple/90 text-white px-3 py-2 text-xs font-medium"
                    >
                      Connect Wallet
                    </button>
                  );
                }

                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-300">
                      {account.address.slice(0, 6)}…{account.address.slice(-4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((s) => !s)}
                      className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700 hover:border-accentPurple transition-all"
                    >
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  </div>
                );
              }}
            </ConnectButton.Custom>

            {isConnected && menuOpen && (
              <div className="absolute right-0 top-11 w-40 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden">
                <button
                  onClick={() => {
                    router.push("/profile");
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-neutral-800"
                >
                  Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-800"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showModal && pendingWallet && (
        <CreateUserModal
          walletAddress={pendingWallet}
          onSuccess={() => {
            setShowModal(false);
            setDidAuthThisSession(true);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
