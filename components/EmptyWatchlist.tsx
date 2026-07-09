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

// ─── Sine-wave cascade loading animation ────────────────────────────────────
//
// 10 horizontal sine waves share identical amplitude (A), wavelength (k),
// and angular velocity (ω).  The only differences are:
//   • A constant vertical offset  →  y_i = i * spacing
//   • A constant phase offset     →  φ_i = i * Δφ
//
// So line i traces:   y(x,t) = A·sin(k·x + ω·t + i·Δφ) + i·spacing
//
// Entrance: lines reveal top-to-bottom.  Line i starts drawing from x=0
// after a stagger delay of i * LINE_STAGGER_MS, sweeping rightward.
// Because each line already carries a phase offset, the reveal naturally
// looks like the wave is propagating downward.

const NUM_LINES         = 10;
const AMPLITUDE         = 18;        // px – same for every line
const WAVELENGTH        = 260;       // px – spatial period
const WAVE_SPEED        = 1.1;       // cycles/sec  (ω = 2π · WAVE_SPEED)
const PHASE_DELTA       = 0.3;       // Δφ radians between adjacent lines
const LINE_STAGGER_MS   = 90;        // cascade delay between lines appearing
const REVEAL_DURATION_MS = 520;      // time for one line to sweep in fully
const LINE_COLOR        = "#00c805"; // system positive green
const LINE_WIDTH        = 1.8;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let W = 0, H = 0;

    function resize() {
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width  = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const startTime = performance.now();
    const k  = (2 * Math.PI) / WAVELENGTH;   // spatial frequency
    const ω  = 2 * Math.PI * WAVE_SPEED;      // angular velocity

    function frame(now: number) {
      const elapsed = now - startTime;
      const t       = elapsed / 1000;          // seconds

      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);

      // Evenly distribute lines across the vertical space
      const spacing = H / (NUM_LINES + 1);

      ctx!.lineWidth   = LINE_WIDTH;
      ctx!.lineJoin    = "round";
      ctx!.lineCap     = "round";
      ctx!.strokeStyle = LINE_COLOR;

      for (let i = 0; i < NUM_LINES; i++) {
        const lineElapsed = elapsed - i * LINE_STAGGER_MS;
        if (lineElapsed <= 0) continue;                        // not yet started

        const revealT  = Math.min(1, lineElapsed / REVEAL_DURATION_MS);
        const revealX  = W * easeOutCubic(revealT);           // how far line has drawn
        if (revealX < 1) continue;

        const baseY  = spacing * (i + 1);                     // vertical centre
        const phase  = i * PHASE_DELTA;                       // φ_i = i · Δφ

        // Sample y at position x:
        //   y(x) = baseY + A · sin(k·x + ω·t + φ_i)
        const sample = (x: number) =>
          baseY + AMPLITUDE * Math.sin(k * x - ω * t + phase);

        // Draw smooth curve using midpoint quadratic bezier segments
        const STEP = 8; // px between sample points
        ctx!.beginPath();
        ctx!.moveTo(0, sample(0));
        for (let x = STEP; x < revealX; x += STEP) {
          const prevX = x - STEP;
          const mx    = (prevX + x) / 2;
          ctx!.quadraticCurveTo(prevX, sample(prevX), mx, sample(mx));
        }
        // Final segment to the reveal frontier
        ctx!.lineTo(revealX, sample(revealX));
        ctx!.stroke();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black" role="status" aria-label={label}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export function CandleLoader() {
  return <LoadingScreen />;
}
