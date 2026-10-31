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

function DebtEquityRange({ indicators, debtEquityRatio }: { indicators: FilingIndicator[]; debtEquityRatio?: number | string | null }) {
  const latest = [...indicators].reverse().find((item) => item.debt !== null && item.equity !== null);
  const ratio = debtEquityRatio == null ? Number.NaN : typeof debtEquityRatio === "number" ? debtEquityRatio : Number(debtEquityRatio);
  const finnhubDebtShare = Number.isFinite(ratio) && ratio >= 0 ? (ratio / (1 + ratio)) * 100 : null;
  const debt = latest?.debt === null || latest?.debt === undefined ? null : Math.max(0, latest.debt);
  const equity = latest?.equity === null || latest?.equity === undefined ? null : Math.max(0, latest.equity);
  const total = debt !== null && equity !== null ? debt + equity : 0;
  const debtShare = finnhubDebtShare ?? (total > 0 && debt !== null ? (debt / total) * 100 : null);
  if (debtShare === null) return null;
  const equityShare = 100 - debtShare;
  const debtColor = sentimentColorForHeight(debtShare);
  const equityColor = sentimentColorForHeight(equityShare);

  return (
    <div className="mb-7">
      <p className="-ml-5 mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-accent">
        <OptionalSvgIcon name="capex" className="h-5 w-5" colorClassName="text-accent" />Debt to equity
      </p>
      <div className="mb-5 text-text-primary">
        <WheelPrice value={`${debtShare.toFixed(1)}%`} size="xs" compact />
      </div>
      <div className="relative h-2 w-full rounded-full bg-panel-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{
            width: `${debtShare}%`,
            backgroundColor: debtColor,
            boxShadow: `0 0 10px ${debtColor.replace("rgb(", "rgba(").replace(")", ", 0.55)")}`,
          }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full"
          style={{
            width: `${equityShare}%`,
            backgroundColor: equityColor,
            boxShadow: `0 0 10px ${equityColor.replace("rgb(", "rgba(").replace(")", ", 0.55)")}`,
          }}
        />
        <span
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${debtShare}%`, backgroundColor: "var(--color-range-marker)" }}
          aria-label={`Debt ${debtShare.toFixed(1)}%, equity ${(100 - debtShare).toFixed(1)}%`}
        />
      </div>
      <div className="mt-2 flex justify-between gap-2 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--color-range-marker)" }}>
        <span>Debt</span>
        <span>Equity</span>
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
              : field === "debt" && value >= 0
                ? 50 - (value / maxPositive) * 50
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

export function FilingIndicators({ symbol, compact = false, includeExtendedMetrics = false, debtEquityRatio }: { symbol: string; compact?: boolean; includeExtendedMetrics?: boolean; debtEquityRatio?: number | string | null }) {
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
  const hasFinnhubDebtEquityRatio = debtEquityRatio != null && Number.isFinite(Number(debtEquityRatio)) && Number(debtEquityRatio) >= 0;
  if (indicators !== null && !hasAnyChart) return null;

  return (
    <section ref={sectionRef} className="mt-6 rounded-xl bg-black p-5" aria-label="SEC filing indicators">
      {indicators === null ? (
        <p className="py-10 text-center text-sm text-text-muted">Loading SEC filing data…</p>
      ) : (
        <div className="space-y-8">
          {includeExtendedMetrics && (
      <div className={`filing-category-selector chart-period-selector-glass relative mx-auto flex max-w-full items-center rounded-full border p-1 ${compact ? "filing-category-selector--compact" : ""}`}>
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
                    className={`relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full font-semibold transition-colors ${compact ? "px-1 py-1.5 text-[8px]" : "px-2 py-2 text-[8px]"} ${selected ? "text-on-accent" : "text-accent"}`}
                  >
                    <OptionalSvgIcon name={category.icon} className="h-6 w-6" colorClassName={selected ? "text-on-accent" : "text-accent"} />
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
            {includeExtendedMetrics && activeCategory === "financial-health" && (hasFinnhubDebtEquityRatio || indicators.some((indicator) => indicator.debt !== null)) && (
              <>
              <DebtEquityRange indicators={indicators} debtEquityRatio={debtEquityRatio} />
              {indicators.some((indicator) => indicator.debt !== null) && (
                <AnnualIndicatorChart title="Debt" icon="capex" field="debt" valueFormat="currency" indicators={indicators} started={started} compact={compact} />
              )}
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
