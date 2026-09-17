"use client";

import { useEffect, useRef, useState } from "react";

import { formatCompact } from "@/lib/format";

type FilingIndicator = {
  year: number;
  capex: number | null;
  researchAndDevelopment: number | null;
  freeCashFlow: number | null;
};

type IndicatorKey = "capex" | "researchAndDevelopment" | "freeCashFlow";

// Matches the red → orange → yellow → lime → emerald progression used by
// Stock Sentiment. The percentage is a bar's relative height within its row.
function sentimentColorForHeight(percentage: number) {
  const stops: [number, [number, number, number]][] = [
    [0, [220, 38, 38]], [25, [249, 115, 22]], [50, [250, 204, 21]],
    [75, [163, 230, 53]], [100, [52, 211, 153]]
  ];
  let low = stops[0];
  let high = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (percentage >= stops[index][0] && percentage <= stops[index + 1][0]) {
      low = stops[index];
      high = stops[index + 1];
      break;
    }
  }
  const progress = (percentage - low[0]) / (high[0] - low[0] || 1);
  const red = Math.round(low[1][0] + (high[1][0] - low[1][0]) * progress);
  const green = Math.round(low[1][1] + (high[1][1] - low[1][1]) * progress);
  const blue = Math.round(low[1][2] + (high[1][2] - low[1][2]) * progress);
  return `rgb(${red}, ${green}, ${blue})`;
}

function AnnualIndicatorChart({
  title,
  field,
  indicators,
  started
}: {
  title: string;
  field: IndicatorKey;
  indicators: FilingIndicator[];
  started: boolean;
}) {
  const [animated, setAnimated] = useState(false);
  const values = indicators.map((indicator) => indicator[field]);
  const maxMagnitude = Math.max(...values.filter((value): value is number => value !== null).map((value) => Math.abs(value)), 1);
  const maxPositive = Math.max(...values.filter((value): value is number => value !== null && value >= 0), 1);
  const maxNegative = Math.max(...values.filter((value): value is number => value !== null && value < 0).map((value) => Math.abs(value)), 1);
  const hasNegativeValues = values.some((value) => (value ?? 0) < 0);
  const baseline = hasNegativeValues ? "45%" : "14%";

  useEffect(() => {
    if (!started) {
      setAnimated(false);
      return;
    }
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [started]);

  return (
    <section>
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">{title}</p>
      <div className="relative h-64 border-y border-border-subtle">
        <div className="absolute inset-x-0 border-t border-border-subtle" style={{ top: baseline }} aria-hidden />
        <div className="grid h-full grid-flow-col auto-cols-fr">
          {indicators.map((indicator) => {
            const value = indicator[field];
            const percentage = value === null ? 0 : (Math.abs(value) / maxMagnitude) * 100;
            // Only charts containing a negative value reserve a lower half.
            // Positive-only metrics can therefore use almost the full height.
            const height = value === null ? 0 : Math.max(percentage * (hasNegativeValues ? 0.4 : 0.78), 3);
            const negative = (value ?? 0) < 0;
            // Shift the sentiment scale around zero: negative values run
            // red→orange, zero is yellow, and positive values run lime→green.
            const sentimentPosition = value === null
              ? 50
              : value < 0
                ? 50 - (Math.abs(value) / maxNegative) * 50
                : 50 + (value / maxPositive) * 50;
            const color = sentimentColorForHeight(sentimentPosition);
            return (
              <div key={indicator.year} className="group relative border-l border-border-subtle first:border-l-0">
                {value !== null && (
                  <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-accent/70 bg-black px-2 py-1 text-xs font-semibold text-accent opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    ${formatCompact(value)}
                  </div>
                )}
                <div
                  className="absolute left-1/2 w-1/4 max-w-5 -translate-x-1/2 rounded-sm"
                  style={{
                    ...(negative ? { top: baseline } : { bottom: hasNegativeValues ? "55%" : baseline }),
                    height: animated ? `${height}%` : "0%",
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color.replace("rgb(", "rgba(").replace(")", ", 0.42)")}`,
                    transition: "height 1.657s cubic-bezier(0.22, 1, 0.36, 1)"
                  }}
                  aria-label={value === null ? `${indicator.year}: unavailable` : `${indicator.year}: $${formatCompact(value)}`}
                />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-accent">{indicator.year}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FilingIndicators({ symbol }: { symbol: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [indicators, setIndicators] = useState<FilingIndicator[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/filing-indicators?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ indicators?: FilingIndicator[] }> : { indicators: [] })
      .then((data) => { if (!controller.signal.aborted) setIndicators(data.indicators ?? []); })
      .catch(() => { if (!controller.signal.aborted) setIndicators([]); });
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (indicators !== null && indicators.length === 0) return null;

  return (
    <section ref={sectionRef} className="mt-6 rounded-xl bg-black p-5">
      {indicators === null ? (
        <p className="py-10 text-center text-sm text-text-muted">Loading SEC filing data…</p>
      ) : (
        <div className="space-y-8">
          <AnnualIndicatorChart title="CapEx" field="capex" indicators={indicators} started={started} />
          <AnnualIndicatorChart title="R&D" field="researchAndDevelopment" indicators={indicators} started={started} />
          <AnnualIndicatorChart title="Free cash flow" field="freeCashFlow" indicators={indicators} started={started} />
        </div>
      )}
    </section>
  );
}
