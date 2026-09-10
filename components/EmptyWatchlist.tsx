"use client";

import { useEffect, useRef } from "react";

export function EmptyWatchlist({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <LoadingScreen />;

  return (
    <section className="rounded-md border border-dashed border-border-subtle bg-panel/70 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-panel-muted text-positive">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-text-primary">Your watchlist is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
        Search for a company or ticker above, open its detail page, and add it to your watchlist.
      </p>
    </section>
  );
}

// ─── Full-screen loading background ─────────────────────────────────────────
//
// Background: a slowly shifting linear gradient rising from the bottom,
// cycling through the same two accent colours used everywhere else in the
// app (green → red), adapting its base tone to light vs dark mode.
//
// On top of it sits a bigger version of the same candle-breathing animation
// used while an individual stock's chart is loading, for visual consistency
// across every loading state in the app.

const C_TOP:  [number,number,number] = [0x00, 0xc8, 0x05];
const C_BOT:  [number,number,number] = [0xff, 0x30, 0x03];

// Background palette: dark-mode (black base) and light-mode (white base)
const BG_DARK:  [number,number,number] = [0x00, 0x00, 0x00];
const BG_LIGHT: [number,number,number] = [0xff, 0xff, 0xff];

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Use the app's actual resolved theme (set on <html> by the settings
    // panel), not the OS preference — otherwise the background stays black
    // even when the user has explicitly chosen light mode.
    const isLight = document.documentElement.classList.contains("light-mode");
    const bgBase = isLight ? BG_LIGHT : BG_DARK;

    let raf = 0;
    let W = 0, H = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width  = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const t = elapsed / 1000;

      // ── Background: linear gradient rising from the bottom, fading to base
      //    at mid-screen. Colour cycles between the two accent colours.
      const bgAccentT = (Math.sin(t * 1.2) * 0.5 + 0.5);

      const aR = Math.round(C_TOP[0] + (C_BOT[0]-C_TOP[0])*bgAccentT);
      const aG = Math.round(C_TOP[1] + (C_BOT[1]-C_TOP[1])*bgAccentT);
      const aB = Math.round(C_TOP[2] + (C_BOT[2]-C_TOP[2])*bgAccentT);

      // 40% accent at the very bottom edge — moderate intensity
      const bottomR = Math.round(bgBase[0]*0.60 + aR*0.40);
      const bottomG = Math.round(bgBase[1]*0.60 + aG*0.40);
      const bottomB = Math.round(bgBase[2]*0.60 + aB*0.40);

      // Gradient: bottom of screen → mid-screen (pure base = black/white)
      const grad = ctx!.createLinearGradient(0, H, 0, H * 0.5);
      grad.addColorStop(0,   `rgb(${bottomR},${bottomG},${bottomB})`);
      grad.addColorStop(1,   `rgb(${bgBase[0]},${bgBase[1]},${bgBase[2]})`);

      // Fill entire canvas with base first, then overlay the gradient
      ctx!.fillStyle = `rgb(${bgBase[0]},${bgBase[1]},${bgBase[2]})`;
      ctx!.fillRect(0, 0, W, H);
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50" role="status" aria-label={label}>
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Bigger version of the chart's own candle-breathing loader */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
        <style>{`
          @keyframes chart-candle-breathe-lg { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(1.4)} }
          @keyframes chart-wick-breathe-lg   { 0%,100%{opacity:0.25;transform:scaleY(0.7)} 50%{opacity:0.9;transform:scaleY(1.3)} }
          .cc-lg-1{animation:chart-candle-breathe-lg 1.8s ease-in-out infinite -1.8s;transform-origin:bottom}
          .cc-lg-2{animation:chart-candle-breathe-lg 1.8s ease-in-out infinite -1.32s;transform-origin:bottom}
          .cc-lg-3{animation:chart-candle-breathe-lg 1.8s ease-in-out infinite -0.84s;transform-origin:bottom}
          .cw-lg-1{animation:chart-wick-breathe-lg 1.8s ease-in-out infinite -1.8s;transform-origin:bottom}
          .cw-lg-2{animation:chart-wick-breathe-lg 1.8s ease-in-out infinite -1.32s;transform-origin:bottom}
          .cw-lg-3{animation:chart-wick-breathe-lg 1.8s ease-in-out infinite -0.84s;transform-origin:bottom}
        `}</style>
        <div className="flex items-end gap-3 h-24">
          <div className="flex flex-col items-center gap-1">
            <div className="cw-lg-1 w-1 h-4 rounded-full bg-positive/50" />
            <div className="cc-lg-1 w-8 h-10 rounded-md bg-positive/50" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="cw-lg-2 w-1 h-5 rounded-full bg-positive/70" />
            <div className="cc-lg-2 w-8 h-16 rounded-md bg-positive/70" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="cw-lg-3 w-1 h-6 rounded-full bg-positive" />
            <div className="cc-lg-3 w-8 h-20 rounded-md bg-positive" />
          </div>
        </div>
        <span className="text-sm font-medium text-text-muted">{label}</span>
      </div>
    </div>
  );
}

export function CandleLoader() {
  return <LoadingScreen />;
}
