import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import ReduxProvider from '@/components/providers/ReduxProvider';
import { Providers } from './providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Monadice',
  description: 'Crypto Prediction Markets Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0d0d0d] text-gray-200`}
      >
        <ReduxProvider>
          <Providers>
            <Header />
            <main className="min-h-screen">{children}</main>
          </Providers>
        </ReduxProvider>
      </body>
    </html>
  );
}
