"use client";

import { useEffect, useRef, useState } from "react";

import { formatCompact, formatPercent } from "@/lib/format";
import { WheelPrice } from "@/components/PriceChart";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

type FilingIndicator = {
  year: number;
  revenue: number | null;
  debt: number | null;
  equity: number | null;
  netMargin: number | null;
  capex: number | null;
  researchAndDevelopment: number | null;
  freeCashFlow: number | null;
};

type IndicatorKey = "revenue" | "debt" | "netMargin" | "capex" | "researchAndDevelopment" | "freeCashFlow";

function DebtEquityRange({ indicators }: { indicators: FilingIndicator[] }) {
  const latest = [...indicators].reverse().find((item) => item.debt !== null && item.equity !== null);
  if (!latest || latest.debt === null || latest.equity === null) return null;
  const debt = Math.max(0, latest.debt);
  const equity = Math.max(0, latest.equity);
  const total = debt + equity;
  if (total <= 0) return null;
  const debtShare = (debt / total) * 100;

  return (
    <div className="mb-7">
      <p className="mb-3 text-xs uppercase tracking-[0.12em] text-text-muted">Debt vs. equity · {latest.year}</p>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-text-primary">
        <span>Debt ${formatCompact(debt)}</span>
        <span>Equity ${formatCompact(equity)}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-panel-muted">
        <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${debtShare}%`, backgroundColor: "var(--color-negative)" }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full" style={{ width: `${100 - debtShare}%`, backgroundColor: "var(--color-positive)" }} />
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
          style={{ left: `${debtShare}%`, backgroundColor: debtShare >= 50 ? "var(--color-negative)" : "var(--color-positive)" }}
          aria-label={`Debt ${debtShare.toFixed(1)}%, equity ${(100 - debtShare).toFixed(1)}%`}
        />
      </div>
    </div>
  );
}

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
  icon,
  field,
  indicators,
  started,
  compact = false,
  valueFormat = "currency"
}: {
  title: string;
  icon?: string;
  field: IndicatorKey;
  indicators: FilingIndicator[];
  started: boolean;
  /** Phone stock pages use a shorter chart while retaining all interactions. */
  compact?: boolean;
  valueFormat?: "currency" | "percent";
}) {
  const [animated, setAnimated] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const values = indicators.map((indicator) => indicator[field]);
  const latestValue = [...values].reverse().find((value): value is number => value !== null) ?? null;
  const displayedValue = hoveredValue ?? latestValue;
  const formatValue = (value: number) => valueFormat === "percent" ? formatPercent(value) : `$${formatCompact(value)}`;
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
      <p className="-ml-5 mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        {icon && <OptionalSvgIcon name={icon} className="h-5 w-5" colorClassName="text-accent" />}{title}
      </p>
      <div className="mb-5 text-text-primary">
        <WheelPrice value={displayedValue === null ? "N/A" : formatValue(displayedValue)} size="xs" compact />
      </div>
      <div className={`relative ${compact ? "h-52" : "h-64"} border-y border-border-subtle`}>
        <div
          className="absolute inset-x-0 border-t border-border-subtle"
          style={hasNegativeValues ? { top: baseline } : { bottom: baseline }}
          aria-hidden
        />
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
              <div
                key={indicator.year}
                className="relative border-l border-border-subtle first:border-l-0"
                onMouseEnter={() => { if (value !== null) setHoveredValue(value); }}
                onMouseLeave={() => setHoveredValue(null)}
              >
                <div
                  className="absolute left-1/2 w-1/4 max-w-5 -translate-x-1/2 rounded-sm"
                  style={{
                    ...(negative ? { top: baseline } : { bottom: hasNegativeValues ? "55%" : baseline }),
                    height: animated ? `${height}%` : "0%",
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color.replace("rgb(", "rgba(").replace(")", ", 0.42)")}`,
                    transition: "height 1.657s cubic-bezier(0.22, 1, 0.36, 1)"
                  }}
                  aria-label={value === null ? `${indicator.year}: unavailable` : `${indicator.year}: ${formatValue(value)}`}
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

export function FilingIndicators({ symbol, compact = false, includeExtendedMetrics = false }: { symbol: string; compact?: boolean; includeExtendedMetrics?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [indicators, setIndicators] = useState<FilingIndicator[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<"growth" | "financial-health" | "cash-flows">("growth");

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

  const hasAnyChart = indicators?.some((indicator) =>
    (includeExtendedMetrics && (indicator.revenue !== null || indicator.debt !== null || indicator.netMargin !== null)) ||
    indicator.capex !== null || indicator.researchAndDevelopment !== null || indicator.freeCashFlow !== null
  );
  const chartCategories = [
    { id: "growth" as const, label: "Growth", icon: "growth" },
    { id: "financial-health" as const, label: "Financial health", icon: "financial-health" },
    { id: "cash-flows" as const, label: "Cash flows", icon: "cash-flows" },
  ];
  if (indicators !== null && !hasAnyChart) return null;

  return (
    <section ref={sectionRef} className="mt-6 rounded-xl bg-black p-5" aria-label="SEC filing indicators">
      {indicators === null ? (
        <p className="py-10 text-center text-sm text-text-muted">Loading SEC filing data…</p>
      ) : (
        <div className="space-y-8">
          {includeExtendedMetrics && (
            <div className="filing-category-selector chart-period-selector-glass relative mx-auto flex max-w-full items-center rounded-full border p-1">
              <span
                className="filing-category-indicator"
                aria-hidden="true"
                style={{ transform: `translateX(${chartCategories.findIndex((category) => category.id === activeCategory) * 100}%)` }}
              />
              {chartCategories.map((category) => {
                const selected = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveCategory(category.id)}
                    className={`relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] font-semibold transition-colors ${selected ? "text-on-accent" : "text-accent"}`}
                  >
                    <OptionalSvgIcon name={category.icon} className="h-5 w-5" colorClassName={selected ? "text-on-accent" : "text-accent"} />
                    <span className="whitespace-nowrap">{category.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="space-y-8">
            {(!includeExtendedMetrics || activeCategory === "growth") && (
              <>
                {includeExtendedMetrics && indicators.some((indicator) => indicator.revenue !== null) && (
                  <AnnualIndicatorChart title="Revenue" icon="capex" field="revenue" valueFormat="currency" indicators={indicators} started={started} compact={compact} />
                )}
                {includeExtendedMetrics && indicators.some((indicator) => indicator.netMargin !== null) && (
                  <AnnualIndicatorChart title="Net margin" icon="capex" field="netMargin" valueFormat="percent" indicators={indicators} started={started} compact={compact} />
                )}
              </>
            )}
            {includeExtendedMetrics && activeCategory === "financial-health" && indicators.some((indicator) => indicator.debt !== null) && (
              <>
              <DebtEquityRange indicators={indicators} />
              <AnnualIndicatorChart title="Debt" icon="capex" field="debt" valueFormat="currency" indicators={indicators} started={started} compact={compact} />
              </>
            )}
            {(!includeExtendedMetrics || activeCategory === "cash-flows") && (
              <>
                {indicators.some((indicator) => indicator.capex !== null) && (
                  <AnnualIndicatorChart title="CapEx" icon="capex" field="capex" indicators={indicators} started={started} compact={compact} />
                )}
                {indicators.some((indicator) => indicator.researchAndDevelopment !== null) && (
                  <AnnualIndicatorChart title="R&D" icon="capex" field="researchAndDevelopment" indicators={indicators} started={started} compact={compact} />
                )}
                {indicators.some((indicator) => indicator.freeCashFlow !== null) && (
                  <AnnualIndicatorChart title="Free cash flow" icon="capex" field="freeCashFlow" indicators={indicators} started={started} compact={compact} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
