"use client";

import { useEffect, useRef, useState } from "react";

type RouletteBannerProps = {
  // Accepts the standard stages from your enum
  stage: "PREPARATION" | "RESOLUTION" | "RESULT" | string;
  resultNumber: number | null;
  // Changed to string because page.tsx now pre-formats it to MM:SS
  timer?: string | null; 
};

export default function RouletteBanner({ stage, resultNumber, timer }: RouletteBannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFinished, setVideoFinished] = useState(false);

  // 1. Video Selection Logic
  const getVideoSrc = (currentStage: string) => {
    switch (currentStage) {
      case "RESOLUTION": 
        // Stage 1 & 2: Blockchain is requesting/settling randomness
        return "/rouletteStage2.mp4"; 
      case "RESULT":     
        // Stage 3: The final reveal video
        return "/rouletteStage3.mp4"; 
      case "PREPARATION":
      default:           
        // Stage 4: Betting table open
        return "/rouletteStage1.mp4"; 
    }
  };

  const videoSrc = getVideoSrc(stage);

  // 2. Handle Video Loading and State Resets
  useEffect(() => {
    if (videoRef.current) {
      // Every time the video source changes, we reset the reveal state
      setVideoFinished(false); 
      videoRef.current.load();
      videoRef.current.play().catch((err) => {
        console.warn("Autoplay blocked or video error:", err);
      });
    }
  }, [videoSrc]);

  return (
    <section className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-[340px] overflow-hidden bg-[#050505]">
      
      {/* Background Video Layer */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity duration-1000"
        autoPlay
        muted
        playsInline
        // The Result video plays once to trigger the number reveal; others loop for atmosphere
        loop={stage !== "RESULT"} 
        onEnded={() => setVideoFinished(true)}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />

      {/* Center Content Layer */}
      <div className="relative z-10 h-full flex items-center justify-center">
        
        {/* STAGE 4: PREPARATION (Table Open) */}
        {stage === "PREPARATION" && (
          <div className="text-center animate-in fade-in zoom-in duration-700">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white drop-shadow-2xl uppercase">
              Place Your Bets
            </h1>
            {timer && (
              <div className="mt-6 inline-block">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mb-2">
                  Time Remaining
                </div>
                <div className="text-4xl font-mono text-accentPurple bg-black/60 px-6 py-2 rounded-xl border border-white/10 shadow-[0_0_30px_rgba(155,93,229,0.2)]">
                  {timer}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STAGE 1 & 2: RESOLUTION (Rolling) */}
        {stage === "RESOLUTION" && (
          <div className="text-center animate-in fade-in duration-500">
            <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-2xl animate-pulse tracking-tight italic uppercase">
              Rolling
            </h1>
            <p className="text-accentPurple/80 text-xs font-bold tracking-[0.4em] mt-4 uppercase">
              Settling on-chain
            </p>
          </div>
        )}

        {/* STAGE 3: RESULT (Reveal) */}
        {stage === "RESULT" && (
          <div className="text-center">
            {!videoFinished ? (
              // Shown while rouletteStage3.mp4 is playing
              <div className="animate-pulse">
                <h1 className="text-4xl font-bold text-white/50 italic tracking-widest uppercase">
                  Revealing...
                </h1>
              </div>
            ) : (
              // Shown only after video ends
              <div className="animate-in zoom-in-50 fade-in duration-500">
                <div className="text-xs font-bold uppercase text-accentPurple mb-2 tracking-[0.3em] bg-accentPurple/10 px-4 py-1 rounded-full border border-accentPurple/20 inline-block">
                  Winning Number
                </div>
                <div className="text-9xl font-black text-white drop-shadow-[0_0_50px_rgba(155,93,229,0.9)] scale-110">
                  {resultNumber ?? "?"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}