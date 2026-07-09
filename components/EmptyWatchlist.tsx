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

// ─── Wave-field loading animation ───────────────────────────────────────────
//
// All lines sample the SAME underlying field:
//   displacement(x, i) = A · sin(k·x  −  ω·t  +  i·Δφ)
//
// where i is the line index (0 = top).  The phase term i·Δφ is small
// (~0.18 rad) so adjacent lines are barely out of phase — they read as one
// continuous fabric rather than independent oscillators.
//
// Lines are spaced ~14 px apart so ~50 of them fill a 720 px screen,
// giving the dense striped surface in the reference image.
//
// Color: each line's hue is derived from its current vertical centre,
// smoothly interpolating #c5f446 → #ff3003 top-to-bottom with a slow
// oscillating phase so the gradient breathes over time.
//
// Entrance: lines cascade in top-to-bottom.  Line i starts revealing
// from x=0 after i·STAGGER_MS delay, sweeping right with easeOutCubic.
// Because Δφ is already embedded in the wave, the cascading entrance
// naturally continues the diagonal flow.

const LINE_SPACING_PX    = 14;    // px between line centres — unchanged
const NUM_LINES          = 30;    // fixed count, centered on screen (not screen-filling)
const AMPLITUDE          = 22;    // px  — vertical swing
const WAVELENGTH         = 480;   // px  — spatial period (long → fabric feel)
const WAVE_SPEED         = 0.75;  // cycles/sec  — 2.5× faster than before
const PHASE_DELTA        = 0.18;  // Δφ radians between adjacent lines — unchanged
const STAGGER_MS         = 28;    // cascade delay per line — unchanged
const REVEAL_MS          = 480;   // sweep-in duration per line — unchanged
const LINE_WIDTH         = 1.1;

// Color stops — yellow-green to red-orange
const C_TOP:  [number,number,number] = [0xc5, 0xf4, 0x46];
const C_BOT:  [number,number,number] = [0xff, 0x30, 0x03];

function lerpColor(a: [number,number,number], b: [number,number,number], t: number): string {
  const r = Math.round(a[0] + (b[0]-a[0])*t);
  const g = Math.round(a[1] + (b[1]-a[1])*t);
  const bv= Math.round(a[2] + (b[2]-a[2])*t);
  return `rgb(${r},${g},${bv})`;
}
function easeOutCubic(t: number) { return 1 - Math.pow(1-t, 3); }

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

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

    const k = (2 * Math.PI) / WAVELENGTH;
    const ω = 2 * Math.PI * WAVE_SPEED;
    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const t = elapsed / 1000;

      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);

      // Fixed number of lines, centered vertically on screen
      const numLines = NUM_LINES;
      const fieldTop = (H - (numLines - 1) * LINE_SPACING_PX) / 2;

      ctx!.lineWidth = LINE_WIDTH;
      ctx!.lineJoin  = "round";
      ctx!.lineCap   = "round";

      const STEP = 6; // px between sample points along x

      for (let i = 0; i < numLines; i++) {
        // Cascade reveal
        const lineElapsed = elapsed - i * STAGGER_MS;
        if (lineElapsed <= 0) continue;

        const revealT = Math.min(1, lineElapsed / REVEAL_MS);
        const revealX = W * easeOutCubic(revealT);
        if (revealX < 1) continue;

        // Vertical centre of this line (rest position)
        const baseY = fieldTop + i * LINE_SPACING_PX;

        // Color: map line index to 0–1 across the palette, with a slow
        // breathing oscillation so the gradient is never static
        const colorT = (i / (numLines - 1) + 0.15 * Math.sin(t * 0.4)) % 1;
        const clampedT = Math.max(0, Math.min(1, colorT));
        ctx!.strokeStyle = lerpColor(C_TOP, C_BOT, clampedT);

        // Phase for this line: i·Δφ makes each line a tiny slice behind
        // the one above, so the whole stack reads as one tilted wavefront.
        const phase = i * PHASE_DELTA;

        // sample(x) = baseY + A · sin(k·x − ω·t + phase)
        const sample = (x: number) =>
          baseY + AMPLITUDE * Math.sin(k * x - ω * t + phase);

        // Smooth quadratic bezier path
        ctx!.beginPath();
        ctx!.moveTo(0, sample(0));

        for (let x = STEP; x <= revealX; x += STEP) {
          const px = x - STEP;
          const mx = (px + x) / 2;
          ctx!.quadraticCurveTo(px, sample(px), mx, sample(mx));
        }
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
