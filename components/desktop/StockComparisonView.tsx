"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ComparisonPriceChart, COMPARISON_COLORS } from "@/components/desktop/ComparisonPriceChart";
import { ComparisonMarketSentiment } from "@/components/MarketSentiment";
import { WheelPrice } from "@/components/PriceChart";
import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { expectedRevenueGrowthPct, getNextReport } from "@/lib/earnings";
import type { AnalystRecommendation, EarningsEvent } from "@/types/stock";
import type { getStockDetail } from "@/lib/finnhub";

type StockDetail = Awaited<ReturnType<typeof getStockDetail>>;
export type ComparisonDetailPayload = {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
};

type FilingIndicator = {
  year: number;
  capex: number | null;
  researchAndDevelopment: number | null;
  freeCashFlow: number | null;
};
type FilingKey = "capex" | "researchAndDevelopment" | "freeCashFlow";

const SERIES = [
  { key: "a" as const, color: COMPARISON_COLORS.primary },
  { key: "b" as const, color: COMPARISON_COLORS.secondary },
];

function PairedBarSection({ primary, secondary }: { primary: ComparisonDetailPayload; secondary: ComparisonDetailPayload }) {
  const items = [
    ["Primary", primary.stock.profile.name ?? primary.stock.symbol, COMPARISON_COLORS.primary, primary.sentiment.score],
    ["Comparison", secondary.stock.profile.name ?? secondary.stock.symbol, COMPARISON_COLORS.secondary, secondary.sentiment.score],
  ] as const;
  return (
    <section className="rounded-md bg-black p-5">
      <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-accent">Stock Sentiment</p>
      <div className="space-y-4">
        {items.map(([key, name, color, score]) => (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold" style={{ color }}>{name}</span>
              <span style={{ color }}>{Math.round(Math.max(0, Math.min(100, score)))}%</span>
            </div>
            <div className="h-2 rounded-full bg-panel-muted">
              <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}66` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const ANALYST_ROWS = [
  ["Strong Buy", "strongBuy"],
  ["Buy", "buy"],
  ["Hold", "hold"],
  ["Sell", "sell"],
  ["Strong Sell", "strongSell"],
] as const;

function latestRecommendation(items: AnalystRecommendation[]) {
  return [...items].sort((a, b) => b.period.localeCompare(a.period))[0];
}

function analystRatio(item: AnalystRecommendation | undefined, key: (typeof ANALYST_ROWS)[number][1]) {
  if (!item) return 0;
  const total = item.strongBuy + item.buy + item.hold + item.sell + item.strongSell;
  return total ? (item[key] / total) * 100 : 0;
}

function ComparisonAnalystBar({ targetWidth, color, delay, started }: { targetWidth: number; color: string; delay: number; started: boolean }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!started) return;
    let frame = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      function step(now: number) {
        const progress = Math.min(1, (now - start) / 910);
        setWidth((1 - Math.pow(1 - progress, 3)) * targetWidth);
        if (progress < 1) frame = requestAnimationFrame(step);
      }
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [delay, started, targetWidth]);

  return <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}55` }} />;
}

function ComparisonAnalysts({ primary, secondary }: { primary: StockDetail; secondary: StockDetail }) {
  const a = latestRecommendation(primary.recommendations);
  const b = latestRecommendation(secondary.recommendations);
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
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
  return (
    <section ref={sectionRef} className="mt-6 rounded-xl bg-black p-5">
      <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-accent">Analysts</p>
      <div className="space-y-4">
        {ANALYST_ROWS.map(([label, key]) => (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between text-sm"><span className="text-text-muted">{label}</span></div>
            <div className="space-y-1.5">
              {SERIES.map(({ key: seriesKey, color }) => (
                <div key={seriesKey} className="h-2 rounded-full bg-panel-muted">
                  <ComparisonAnalystBar targetWidth={analystRatio(seriesKey === "a" ? a : b, key)} color={color} delay={ANALYST_ROWS.findIndex((row) => row[1] === key) * 80} started={started} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function readMetric(metrics: ComparisonDetailPayload["metrics"], ...keys: string[]) {
  for (const key of keys) {
    const raw = metrics?.[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function fundamentalRows(detail: ComparisonDetailPayload) {
  const metrics = detail.metrics;
  const earnings = detail.stock.earnings as EarningsEvent[];
  const report = getNextReport(earnings);
  const eps = readMetric(metrics, "epsNormalizedAnnual", "epsTTM");
  const pe = readMetric(metrics, "peTTM", "peNormalizedAnnual");
  const growth = readMetric(metrics, "epsGrowth5Y", "epsGrowth3Y", "revenueGrowth5Y", "revenueGrowth3Y");
  const peg = readMetric(metrics, "pegRatio") ?? (pe !== null && growth !== null && growth > 0 ? pe / growth : null);
  return [
    ["Market Cap", formatCompact((detail.stock.profile.marketCapitalization ?? 0) * 1_000_000)],
    ["Beta", formatNumber(readMetric(metrics, "beta"))],
    ["P/E Ratio", formatNumber(pe)],
    ["Forward P/E", formatNumber(readMetric(metrics, "forwardPE"))],
    ["PEG", formatNumber(peg)],
    ["EPS", formatCurrency(eps)],
    ["52W Low", formatCurrency(readMetric(metrics, "52WeekLow"))],
    ["52W High", formatCurrency(readMetric(metrics, "52WeekHigh"))],
    ["Avg. Volume", formatCompact(readMetric(metrics, "10DayAverageTradingVolume") === null ? null : readMetric(metrics, "10DayAverageTradingVolume")! * 1_000_000)],
    ["Dividend Yield", formatPercent(readMetric(metrics, "dividendYieldIndicatedAnnual"))],
    ["Next Report", report ? `Q${report.quarter} ${report.year}` : "N/A"],
    ["Expected Earnings", report ? formatPercent(expectedRevenueGrowthPct(earnings, report)) : "N/A"],
  ] as Array<[string, string]>;
}

function ComparisonIndicators({ primary, secondary }: { primary: ComparisonDetailPayload; secondary: ComparisonDetailPayload }) {
  const aItems = fundamentalRows(primary);
  const bItems = fundamentalRows(secondary);
  return (
    <section>
      <p className="mb-3 px-1 text-sm font-medium uppercase tracking-[0.18em] text-accent">Indicators</p>
      <div className="grid grid-cols-2 gap-2">
        {aItems.map(([label, value], index) => (
          <div key={label} className="min-w-0 rounded-md bg-black p-4">
            <div className="mb-2 flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COMPARISON_COLORS.primary }} /><p className="truncate text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p></div>
            <div className="flex min-w-0 items-baseline justify-start gap-2 overflow-hidden">
              <p className="max-w-[45%] truncate text-xl font-semibold" style={{ color: COMPARISON_COLORS.primary }}>{value}</p>
              <span className="h-6 border-l border-border-subtle" aria-hidden="true" />
              <p className="max-w-[45%] truncate text-xl font-semibold" style={{ color: COMPARISON_COLORS.secondary }}>{bItems[index]?.[1] ?? "N/A"}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilingComparisonCharts({ primarySymbol, secondarySymbol }: { primarySymbol: string; secondarySymbol: string }) {
  const [a, setA] = useState<FilingIndicator[]>([]);
  const [b, setB] = useState<FilingIndicator[]>([]);
  const [hoveredBar, setHoveredBar] = useState<{ key: FilingKey; series: "a" | "b"; value: number } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const years = useMemo(() => [...new Set([...a, ...b].map((item) => item.year))].sort((x, y) => x - y), [a, b]);
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = (symbol: string) => fetch(`/api/filing-indicators?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ indicators?: FilingIndicator[] }> : { indicators: [] })
      .then((data) => data.indicators ?? []);
    Promise.all([fetchData(primarySymbol), fetchData(secondarySymbol)]).then(([first, second]) => {
      if (!controller.signal.aborted) { setA(first); setB(second); }
    }).catch(() => {
      if (!controller.signal.aborted) { setA([]); setB([]); }
    });
    return () => controller.abort();
  }, [primarySymbol, secondarySymbol]);

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
  }, [years.length]);

  const specs: Array<[string, FilingKey]> = [["CapEx", "capex"], ["R&D", "researchAndDevelopment"], ["Free cash flow", "freeCashFlow"]];
  if (!years.length) return null;
  return (
    <section ref={sectionRef} className="rounded-xl bg-black p-5">
      <div className="space-y-8">
        {specs.map(([title, key]) => {
          const aValues = years.map((year) => a.find((item) => item.year === year)?.[key] ?? null);
          const bValues = years.map((year) => b.find((item) => item.year === year)?.[key] ?? null);
          const latestA = [...aValues].reverse().find((value): value is number => value !== null) ?? null;
          if (aValues.every((value) => value === null) && bValues.every((value) => value === null)) return null;
          // One shared scale per metric so matching bar heights represent
          // matching dollar amounts across both stocks.
          const sharedMax = Math.max(
            1,
            ...[...aValues, ...bValues]
              .filter((value): value is number => value !== null)
              .map((value) => Math.abs(value))
          );
          const hasNegative = [...aValues, ...bValues].some((value) => (value ?? 0) < 0);
          const baseline = hasNegative ? 45 : 14;
          const displayedValue = hoveredBar?.key === key ? hoveredBar.value : latestA;
          const displayedColor = hoveredBar?.key === key ? (hoveredBar.series === "a" ? "text-purple-400" : "text-orange-400") : "text-purple-400";
          return (
            <div key={key}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">{title}</p>
              <div className="mb-5 text-text-primary">
                <WheelPrice value={displayedValue === null ? "N/A" : `$${formatCompact(displayedValue)}`} size="xs" compact colorClass={displayedColor} />
              </div>
              <div className="relative h-64 border-y border-border-subtle">
                <div className="absolute inset-x-0 border-t border-border-subtle" style={hasNegative ? { top: `${baseline}%` } : { bottom: `${baseline}%` }} />
                <div className="flex h-full">
                  {years.map((year, index) => {
                    const values = [aValues[index], bValues[index]];
                    return (
                      <div key={year} className="relative min-w-0 flex-1 border-l border-border-subtle first:border-l-0">
                        {values.map((value, seriesIndex) => {
                          if (value === null) return null;
                          const height = Math.max((Math.abs(value) / sharedMax) * 100 * (hasNegative ? 0.4 : 0.78), 3);
                          const negative = value < 0;
                          const color = seriesIndex === 0 ? COMPARISON_COLORS.primary : COMPARISON_COLORS.secondary;
                          return (
                            <div
                              key={seriesIndex}
                              className="absolute w-1/4 max-w-5 -translate-x-1/2 rounded-sm"
                              style={{
                                left: seriesIndex === 0 ? "35%" : "65%",
                                ...(negative ? { top: `${baseline}%` } : { bottom: hasNegative ? "55%" : `${baseline}%` }),
                                height: started ? `${height}%` : "0%",
                                backgroundColor: color,
                                boxShadow: seriesIndex === 0
                                  ? "0 0 10px rgba(168, 85, 247, 0.55)"
                                  : "0 0 10px rgba(249, 115, 22, 0.55)",
                                transition: "height 1.657s cubic-bezier(0.22, 1, 0.36, 1)",
                              }}
                              title={`${year}: ${formatCurrency(value)}`}
                              onMouseEnter={() => setHoveredBar({ key, series: seriesIndex === 0 ? "a" : "b", value })}
                              onMouseLeave={() => setHoveredBar(null)}
                            />
                          );
                        })}
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-text-muted">{year}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StockComparisonView({
  primary,
  secondary,
  onRemovePrimary,
  onRemoveSecondary,
}: {
  primary: ComparisonDetailPayload;
  secondary: ComparisonDetailPayload;
  onRemovePrimary: () => void;
  onRemoveSecondary: () => void;
}) {
  return (
    <div className="relative space-y-6 px-6 pb-8 pt-3">
      <section className="relative p-5">
        <ComparisonPriceChart
          primarySymbol={primary.stock.symbol}
          secondarySymbol={secondary.stock.symbol}
          primaryName={primary.stock.profile.name ?? primary.stock.symbol}
          secondaryName={secondary.stock.profile.name ?? secondary.stock.symbol}
          primaryLogo={primary.stock.profile.logo}
          secondaryLogo={secondary.stock.profile.logo}
          onRemovePrimary={onRemovePrimary}
          onRemoveSecondary={onRemoveSecondary}
        />
      </section>
      <ComparisonMarketSentiment scores={[primary.sentiment.score, secondary.sentiment.score]} />
      <ComparisonAnalysts primary={primary.stock} secondary={secondary.stock} />
      <ComparisonIndicators primary={primary} secondary={secondary} />
      <FilingComparisonCharts primarySymbol={primary.stock.symbol} secondarySymbol={secondary.stock.symbol} />
    </div>
  );
}
