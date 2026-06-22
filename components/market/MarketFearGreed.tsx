"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FearGreedPayload {
  score: number;
  label: string;
  factors: Record<string, { score: number; label: string; value: string }>;
}

function labelForScore(score: number) {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

function colorClassForScore(score: number) {
  if (score <= 20) return { text: "text-red-500"     };
  if (score <= 40) return { text: "text-orange-400"  };
  if (score <= 60) return { text: "text-yellow-400"  };
  if (score <= 80) return { text: "text-lime-400"    };
  return                  { text: "text-emerald-400" };
}

function barColorForPct(pct: number): string {
  const stops: [number, [number,number,number]][] = [
    [0,   [220, 38,  38 ]],
    [25,  [249, 115, 22 ]],
    [50,  [250, 204, 21 ]],
    [75,  [163, 230, 53 ]],
    [100, [52,  211, 153]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct >= stops[i][0] && pct <= stops[i + 1][0]) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const t = (pct - lo[0]) / (hi[0] - lo[0] || 1);
  const r = Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t);
  const g = Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t);
  const b = Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t);
  return `rgb(${r},${g},${b})`;
}

const DIGITS = ["0","1","2","3","4","5","6","7","8","9"];
const DIGIT_RATIO: Record<string, number> = {
  "0": 0.62, "1": 0.36, "2": 0.58, "3": 0.58,
  "4": 0.62, "5": 0.58, "6": 0.60, "7": 0.52,
  "8": 0.62, "9": 0.60,
};

function RollingDigit({ ch, started }: { ch: string; started: boolean }) {
  const isDigit = DIGITS.includes(ch);
  const idx = isDigit ? parseInt(ch) : 0;
  const rowPx = 36;
  const slotPx = Math.round((DIGIT_RATIO[ch] ?? 0.62) * rowPx);
  if (!isDigit) {
    return (
      <span className="inline-block leading-none text-3xl font-bold" style={{ lineHeight: `${rowPx}px` }}>
        {ch}
      </span>
    );
  }
  return (
    <span className="inline-block overflow-hidden align-bottom" style={{ height: rowPx, width: slotPx }}>
      <span
        className="flex flex-col"
        style={{
          transform: started ? `translateY(-${idx * rowPx}px)` : "translateY(0px)",
          transition: started ? "transform 1.657s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          willChange: "transform",
        }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block text-center select-none text-3xl font-bold leading-none" style={{ height: rowPx, lineHeight: `${rowPx}px`, width: slotPx }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function RollingScore({ score, colorClass, started }: { score: number; colorClass: string; started: boolean }) {
  return (
    <span className={cn("inline-flex items-end", colorClass)} style={{ height: 36 }}>
      {String(score).split("").map((ch, i) => (
        <RollingDigit key={i} ch={ch} started={started} />
      ))}
    </span>
  );
}

function AnimatedBar({ score, started }: { score: number; started: boolean }) {
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    if (!started) return;
    const target = Math.min(99, Math.max(1, score));
    const duration = 1755;
    const startT = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min(1, (now - startT) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimPct(eased * target);
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, score]);

  return (
    <div className="h-2 w-full rounded-full bg-panel-muted overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${animPct}%`, backgroundColor: barColorForPct(animPct) }}
      />
    </div>
  );
}

export function MarketFearGreed() {
  const [data, setData] = useState<FearGreedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    fetch("/api/market-sentiment")
      .then((r) => r.json() as Promise<FearGreedPayload>)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Trigger animation once data is loaded and section is visible
  useEffect(() => {
    if (loading || !data) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, data]);

  const score = data?.score ?? 50;
  const label = data?.label ?? "Neutral";
  const { text } = colorClassForScore(score);

  return (
    <section ref={ref} className="rounded-xl border border-border-subtle bg-black p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-4">
        Market Fear &amp; Greed
      </p>

      {loading ? (
        <div className="h-14 flex items-center">
          <span className="text-xs text-text-muted animate-pulse">Loading…</span>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <RollingScore score={score} colorClass={text} started={started} />
            <span className={cn("text-sm font-semibold", text)}>{label}</span>
          </div>

          <AnimatedBar score={score} started={started} />


        </>
      )}
    </section>
  );
}
