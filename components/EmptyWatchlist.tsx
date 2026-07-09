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

// ─── Flow-field loading animation ──────────────────────────────────────────
// Many evenly-spaced horizontal lines, gently distorted by procedural noise
// into a continuous flowing surface, drawn in from the left (cascading
// top-to-bottom), tinted by a slow-scrolling left→right gradient.

const COLOR_LEFT:  readonly [number, number, number] = [0xc5, 0xf4, 0x46];
const COLOR_RIGHT: readonly [number, number, number] = [0xff, 0x30, 0x03];

const NUM_LINES            = 40;
const REVEAL_DURATION_MS   = 620;   // per-line sweep-in: fast start, eases out
const LINE_STAGGER_MS      = 38;    // cascade delay between successive lines
const DRIFT_SPEED          = 26;    // px/sec — ambient rightward flow after reveal
const COLOR_SCROLL_SPEED   = 0.045; // cycles/sec of the gradient drift

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerpColor(c1: readonly [number, number, number], c2: readonly [number, number, number], t: number) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}
// Smooth 0→1→0 triangle, avoids any hard cut when the gradient scrolls/loops
function triangleWave(t: number) {
  const f = t - Math.floor(t);
  return f < 0.5 ? f * 2 : (1 - f) * 2;
}
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}
// Deterministic 2D value noise (no external deps) — gives an organic,
// non-repeating undulation rather than synchronized sine waves.
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2D(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smoothstep(xf), v = smoothstep(yf);
  const a = hash2(xi, yi),     b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const driftSpeed  = reduceMotion ? DRIFT_SPEED * 0.15 : DRIFT_SPEED;
    const colorSpeed  = reduceMotion ? COLOR_SCROLL_SPEED * 0.2 : COLOR_SCROLL_SPEED;

    let raf = 0;
    let width = 0, height = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width  = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width  = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const startTime = performance.now();
    // Deterministic per-line phase offset (golden-ratio sequence) so lines
    // never move in lockstep with each other.
    const lineSeed = Array.from({ length: NUM_LINES }, (_, i) => (i * 0.6180339887) % 1);

    function frame(now: number) {
      const elapsed = now - startTime;
      const t = elapsed / 1000;

      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, width, height);

      const spacing = height / (NUM_LINES + 1);
      const amp1 = spacing * 0.32;
      const amp2 = spacing * 0.14;

      // One scrolling gradient per frame, shared by every line (colour is a
      // function of x only, identical for every row this frame).
      const grad = ctx!.createLinearGradient(0, 0, width, 0);
      const stops = 28;
      for (let s = 0; s <= stops; s++) {
        const frac = s / stops;
        const tw = triangleWave(frac + t * colorSpeed);
        grad.addColorStop(frac, lerpColor(COLOR_LEFT, COLOR_RIGHT, tw));
      }

      ctx!.lineWidth = 1.4;
      ctx!.lineJoin = "round";
      ctx!.lineCap = "round";
      ctx!.strokeStyle = grad;

      const step = 9;

      for (let i = 0; i < NUM_LINES; i++) {
        const y0 = spacing * (i + 1);
        const localElapsed = elapsed - i * LINE_STAGGER_MS;
        if (localElapsed <= 0) continue;

        const revealT  = Math.min(1, localElapsed / REVEAL_DURATION_MS);
        const eased    = easeOutCubic(revealT); // fast swipe in, settles smoothly
        const revealX  = width * eased;
        if (revealX <= 0) continue;

        const seed = lineSeed[i] * 80;
        const sampleY = (x: number) => {
          const flowX = x - t * driftSpeed;
          const nx = flowX * 0.006 + seed;
          const ny = t * 0.14 + seed * 1.7;
          const n1 = noise2D(nx, ny);
          const n2 = noise2D(nx * 2.1 + 4.7, ny * 1.6 + 2.3);
          return y0 + (n1 - 0.5) * 2 * amp1 + (n2 - 0.5) * 2 * amp2;
        };

        const pts: { x: number; y: number }[] = [];
        for (let x = 0; x <= revealX; x += step) pts.push({ x, y: sampleY(x) });
        if (!pts.length || pts[pts.length - 1].x < revealX) {
          pts.push({ x: revealX, y: sampleY(revealX) });
        }
        if (pts.length < 2) continue;

        ctx!.beginPath();
        ctx!.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length - 1; k++) {
          const mx = (pts[k].x + pts[k + 1].x) / 2;
          const my = (pts[k].y + pts[k + 1].y) / 2;
          ctx!.quadraticCurveTo(pts[k].x, pts[k].y, mx, my);
        }
        ctx!.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
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
