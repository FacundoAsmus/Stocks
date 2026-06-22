"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalystRecommendation, PriceTarget } from "@/types/stock";

// ── Rolling digit wheel (same mechanic as PriceChart) ────────────────────
const DIGITS = ["0","1","2","3","4","5","6","7","8","9"];
const DIGIT_RATIO: Record<string, number> = {
  "0": 0.62, "1": 0.36, "2": 0.58, "3": 0.58,
  "4": 0.62, "5": 0.58, "6": 0.60, "7": 0.52,
  "8": 0.62, "9": 0.60,
};

function RollingDigit({ ch, started }: { ch: string; started: boolean }) {
  const isDigit = DIGITS.includes(ch);
  const idx = isDigit ? parseInt(ch) : 0;
  const rowPx = 24;
  const slotPx = Math.round((DIGIT_RATIO[ch] ?? 0.62) * rowPx);
  if (!isDigit) {
    return (
      <span className="inline-block font-semibold text-2xl text-text-primary leading-none" style={{ lineHeight: `${rowPx}px` }}>
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
          transition: started ? "transform 1.365s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          willChange: "transform",
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="block text-center select-none font-semibold text-2xl text-text-primary leading-none"
            style={{ height: rowPx, lineHeight: `${rowPx}px`, width: slotPx }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function RollingCount({ value, started }: { value: number; started: boolean }) {
  return (
    <span className="inline-flex items-end" style={{ height: 24 }}>
      {String(value).split("").map((ch, i) => (
        <RollingDigit key={i} ch={ch} started={started} />
      ))}
    </span>
  );
}

// ── Animated bar ──────────────────────────────────────────────────────────
function AnimatedBar({
  colorClass,
  targetWidth,
  started,
  delay = 0,
}: {
  colorClass: string;
  targetWidth: number;
  started: boolean;
  delay?: number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => {
      const duration = 910;
      const startT = performance.now();
      let raf: number;
      function step(now: number) {
        const t = Math.min(1, (now - startT) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setWidth(eased * targetWidth);
        if (t < 1) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, delay);
    return () => clearTimeout(timer);
  }, [started, targetWidth, delay]);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-panel-muted">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function AnalystSection({
  recommendations,
  priceTarget,
}: {
  recommendations: AnalystRecommendation[];
  priceTarget: PriceTarget;
  currentPrice: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);

  const latest = recommendations[0];
  const analystCount = latest
    ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
    : 0;

  const breakdown = latest
    ? ([
        ["Strong Buy",  latest.strongBuy,  "bg-emerald-400"],
        ["Buy",         latest.buy,        "bg-lime-400"],
        ["Hold",        latest.hold,       "bg-yellow-400"],
        ["Sell",        latest.sell,       "bg-orange-500"],
        ["Strong Sell", latest.strongSell, "bg-red-600"],
      ] as const)
    : [];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="rounded-md border border-[#3a3a42] bg-black p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Analysts</p>
          <h2 className="mt-2 text-2xl font-semibold text-text-primary">Recommendations</h2>
        </div>
        {priceTarget.lastUpdated ? (
          <p className="text-sm text-text-muted">Updated {priceTarget.lastUpdated}</p>
        ) : null}
      </div>

      {latest ? (
        <div className="mt-5 relative">
          <div className="mb-3 flex items-baseline gap-2">
            <RollingCount value={analystCount} started={started} />
            <span className="text-sm text-text-muted">analysts covering this stock</span>
          </div>

          <div className="space-y-4">
            {breakdown.map(([label, count, colorClass], i) => {
              const targetWidth = analystCount
                ? Math.max((count / analystCount) * 100, count ? 4 : 0)
                : 0;

              return (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-text-muted">{label}</span>
                    <RollingCount value={count} started={started} />
                  </div>
                  <AnimatedBar
                    colorClass={colorClass}
                    targetWidth={targetWidth}
                    started={started}
                    delay={i * 80}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-text-muted">
          Finnhub does not currently provide analyst recommendations for this symbol.
        </p>
      )}
    </section>
  );
}
