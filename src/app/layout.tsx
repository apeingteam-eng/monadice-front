import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import ReduxProvider from "@/components/providers/ReduxProvider";
import { Providers } from "./providers";
import { ToastProvider } from "@/components/toast/ToastContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monadice",
  description: "A crypto-native prediction market built on Monad.",
  icons: {
    icon: "/monadiceLogoTransp.png",
    shortcut: "/monadiceLogoTransp.png",
    apple: "/monadiceLogoTransp.png",
  },
  openGraph: {
    title: "Monadice",
    description: "On-chain prediction markets. Zero noise. Pure signal.",
    url: "https://app.monadice.xyz",
    siteName: "Monadice",
    images: [
      {
        url: "/monadiceLogoTransp.png",
        width: 800,
        height: 800,
        alt: "Monadice Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Monadice",
    description: "A crypto-native prediction market built on Monad.",
    images: ["/monadiceLogoTransp.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0d0d0d] text-gray-200`}
      >
        <ReduxProvider>
          <Providers>
            <ToastProvider>
              <Header />
              <main className="min-h-screen">{children}</main>
            </ToastProvider>
          </Providers>
        </ReduxProvider>
      </body>
    </html>
  );
}