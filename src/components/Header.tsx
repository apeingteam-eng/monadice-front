"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";

import type { RootState } from "@/state/store";

import { useLogin } from "@/features/wallet/hooks/useLogin";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import CreateUserModal from "@/features/wallet/components/CreateUserModal";
import { useRouter } from "next/navigation";

interface MarketSummary {
  id: number;
  name: string;
  symbol: string;
  end_time: number;
  state: string;
}

export default function Header() {

  const router = useRouter();
  const [query, setQuery] = useState("");
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { login } = useLogin();

  // ----------------- STATE (MUST BE TOP LEVEL) -----------------
  const [showModal, setShowModal] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [didAuthThisSession, setDidAuthThisSession] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [allMarkets, setAllMarkets] = useState<MarketSummary[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [profileImage, setProfileImage] = useState("/PP.png");

  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("access_token");

  // ----------------- EFFECTS -----------------

  useEffect(() => {
    setMounted(true);
    const img = localStorage.getItem("profile_image");
    if (img) setProfileImage(img);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/factory/campaigns`);
        const data = await res.json();
        setAllMarkets(data);
      } catch (e) {
        console.error("Search preload failed", e);
      }
    }
    load();
  }, []);

 useEffect(() => {
  if (!isConnected) return;       // STOP if wallet disconnected
  if (!address) return;
  if (hasToken) return;
  if (didAuthThisSession) return;

  async function auth() {
    try {
      const res = await login();
      if (res.status === "pending_username") {
        setPendingWallet(res.walletAddress);
        setShowModal(true);
      } else if (res.status === "success") {
        setDidAuthThisSession(true);
      }
    } catch (e) {
      console.error("Login error:", e);
    }
  }

  auth();
}, [isConnected, address, hasToken, didAuthThisSession]);
  useEffect(() => {
    function outsideClick(e: MouseEvent) {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    window.addEventListener("click", outsideClick);
    return () => window.removeEventListener("click", outsideClick);
  }, []);

  // ----------------- SEARCH -----------------
  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return allMarkets
      .filter((m) => m.name.toLowerCase().includes(q) || m.symbol.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allMarkets]);

  // ----------------- LOGOUT -----------------
const handleLogout = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("wallet_address");
  localStorage.removeItem("profile_image");

  setDidAuthThisSession(false);
  setMenuOpen(false);
  disconnect();

  setTimeout(() => router.refresh(), 10); // <-- prevents hydration conflict
};
  // ----------------- ALWAYS RENDER HEADER -----------------
  return (
    <>
      <header className="w-full sticky top-0 z-40 border-b border-neutral-800/60 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/monadiceLogoText.png" className="h-8 object-contain" />
          </Link>

          {/* SEARCH */}
          <div className="flex-1 flex justify-center">
            <div ref={searchBoxRef} className="relative w-full max-w-xl">
             <input
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  onFocus={() => setSearchOpen(true)}
  placeholder="Search markets"
  className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
/>

              <div
                className={`absolute left-0 right-0 top-full mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg overflow-hidden transition-all ${
                  searchOpen && query && searchResults.length > 0
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                {searchResults.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      router.push(`/market/${m.id}`);
                      setSearchOpen(false);
                    }}
                    className="px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 cursor-pointer"
                  >
                    {m.name}
                    <span className="text-accentPurple text-xs ml-2">{m.symbol}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* WALLET / MENU */}
          <div className="ml-auto flex items-center gap-3 relative">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, mounted: ready }) => {
                const connected = ready && account && chain;

                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="bg-accentPurple px-3 py-2 rounded text-xs text-white"
                    >
                      Connect Wallet
                    </button>
                  );
                }

                return (
                  <>
                    <span className="text-xs">{account.address.slice(0, 6)}…{account.address.slice(-4)}</span>

                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="w-8 h-8 rounded-full border border-neutral-700"
                    >
                      <img src={profileImage} className="w-full h-full object-cover" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 top-11 w-40 bg-neutral-900 border border-neutral-700 rounded-lg">
                        <button
                          className="w-full px-4 py-2 text-sm hover:bg-neutral-800"
                          onClick={() => {
                            router.push("/profile");
                            setMenuOpen(false);
                          }}
                        >
                          Profile
                        </button>

                        <button
                          className="w-full px-4 py-2 text-sm text-red-400 hover:bg-neutral-800"
                          onClick={handleLogout}
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      {showModal && pendingWallet && (
        <CreateUserModal
          walletAddress={pendingWallet}
          onSuccess={() => setShowModal(false)}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}