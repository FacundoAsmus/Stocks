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
// Background: a slowly shifting radial gradient that cycles through the wave
// colours, adapting its base tone to light vs dark mode.
//
// Line colour: each line interpolates #c5f446 → #ff3003 top-to-bottom with
// a slow breathing oscillation.

const NUM_LINES          = 30;
const LINE_SPACING_PX    = 14;
const AMPLITUDE          = 55;    // higher for prominent shape
const WAVELENGTH         = 480;
const WAVE_SPEED         = 0.75;
const PHASE_DELTA        = 0.18;
const STAGGER_MS         = 28;
const REVEAL_MS          = 480;
const LINE_WIDTH         = 1.1;

const C_TOP:  [number,number,number] = [0x00, 0xc8, 0x05];
const C_BOT:  [number,number,number] = [0xff, 0x30, 0x03];

// Background palette: dark-mode (black base) and light-mode (white base)
const BG_DARK:  [number,number,number] = [0x00, 0x00, 0x00];
const BG_LIGHT: [number,number,number] = [0xff, 0xff, 0xff];

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

    // Detect color scheme once on mount; re-runs if scheme changes
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const bgBase = isDark ? BG_DARK : BG_LIGHT;

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

      // ── Background: radial gradient that slowly rotates through wave colours ──
      // The accent colour pulses gently using a slow sine, then fades toward
      // the base (black/white) at the edges so the waves always read clearly.
      const bgAccentT = (Math.sin(t * 0.35) * 0.5 + 0.5);

      // Radial: accent tinted centre (very subtle, ~12% mix), pure base at edges
      const cx = W * (0.35 + 0.3 * Math.sin(t * 0.22));              // drifts L↔R
      const cy = H * (0.35 + 0.25 * Math.sin(t * 0.17 + 1.0));       // drifts U↔D
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);

      // Build tinted-base colour (12% accent mixed into pure base)
      const aR = Math.round(C_TOP[0] + (C_BOT[0]-C_TOP[0])*bgAccentT);
      const aG = Math.round(C_TOP[1] + (C_BOT[1]-C_TOP[1])*bgAccentT);
      const aB = Math.round(C_TOP[2] + (C_BOT[2]-C_TOP[2])*bgAccentT);
      const centreR = Math.round(bgBase[0]*0.88 + aR*0.12);
      const centreG = Math.round(bgBase[1]*0.88 + aG*0.12);
      const centreB = Math.round(bgBase[2]*0.88 + aB*0.12);
      const centreRgb = `rgb(${centreR},${centreG},${centreB})`;
      const edgeRgb   = `rgb(${bgBase[0]},${bgBase[1]},${bgBase[2]})`;

      grad.addColorStop(0,   centreRgb);
      grad.addColorStop(0.6, edgeRgb);
      grad.addColorStop(1,   edgeRgb);
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      // ── Wave lines ──────────────────────────────────────────────────────────
      const numLines  = NUM_LINES;
      const fieldTop  = (H - (numLines - 1) * LINE_SPACING_PX) / 2;

      ctx!.lineWidth = LINE_WIDTH;
      ctx!.lineJoin  = "round";
      ctx!.lineCap   = "round";

      const STEP = 6;

      for (let i = 0; i < numLines; i++) {
        const lineElapsed = elapsed - i * STAGGER_MS;
        if (lineElapsed <= 0) continue;

        const revealT = Math.min(1, lineElapsed / REVEAL_MS);
        const revealX = W * easeOutCubic(revealT);
        if (revealX < 1) continue;

        const baseY  = fieldTop + i * LINE_SPACING_PX;
        const colorT = Math.max(0, Math.min(1,
          (i / (numLines - 1) + 0.15 * Math.sin(t * 0.4)) % 1
        ));
        ctx!.strokeStyle = lerpColor(C_TOP, C_BOT, colorT);

        const phase  = i * PHASE_DELTA;
        const sample = (x: number) =>
          baseY + AMPLITUDE * Math.sin(k * x - ω * t + phase);

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
    <div className="fixed inset-0 z-50" role="status" aria-label={label}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export function CandleLoader() {
  return <LoadingScreen />;
}
