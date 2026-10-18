"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { WheelPrice } from "@/components/PriceChart";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { CandlePoint, ChartPeriod } from "@/types/stock";

export const COMPARISON_COLORS = { primary: "#a855f7", secondary: "#f97316" } as const;

export type ComparisonRow = {
  time: number;
  date: string;
  aPct: number;
  bPct: number;
  aPrice: number;
  bPrice: number;
  aVolume: number | null;
  bVolume: number | null;
};

const PERIODS: ChartPeriod[] = ["1D", "1W", "1M", "2M", "3M", "5M", "6M", "1Y", "2Y", "5Y", "ALL"];

function timestamp(point: CandlePoint) {
  if (Number.isFinite(point.time) && point.time > 0) return point.time;
  const parsed = Date.parse(point.date);
  return Number.isFinite(parsed) ? parsed / 1000 : NaN;
}

function normalizeCandles(points: CandlePoint[]) {
  const byTime = new Map<number, CandlePoint>();
  for (const point of points) {
    const time = timestamp(point);
    if (!Number.isFinite(time) || !Number.isFinite(point.close)) continue;
    byTime.set(time, { ...point, time });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function mergeComparisonCandles(primaryInput: CandlePoint[], secondaryInput: CandlePoint[]): ComparisonRow[] {
  const primary = normalizeCandles(primaryInput);
  const secondary = normalizeCandles(secondaryInput);
  if (!primary.length || !secondary.length) return [];

  const commonStart = Math.max(primary[0].time, secondary[0].time);
  if (primary[primary.length - 1].time < commonStart || secondary[secondary.length - 1].time < commonStart) return [];

  function valueAtStart(points: CandlePoint[]) {
    let value: CandlePoint | null = null;
    for (const point of points) {
      if (point.time > commonStart) break;
      value = point;
    }
    return value;
  }

  const primaryBase = valueAtStart(primary)?.close;
  const secondaryBase = valueAtStart(secondary)?.close;
  if (!Number.isFinite(primaryBase) || !Number.isFinite(secondaryBase) || !primaryBase || !secondaryBase) return [];

  const times = [...new Set([
    ...primary.filter((point) => point.time >= commonStart).map((point) => point.time),
    ...secondary.filter((point) => point.time >= commonStart).map((point) => point.time),
  ])].sort((a, b) => a - b);

  let primaryIndex = 0;
  let secondaryIndex = 0;
  let primaryCurrent: CandlePoint | null = null;
  let secondaryCurrent: CandlePoint | null = null;
  const rows: ComparisonRow[] = [];
  for (const time of times) {
    while (primaryIndex < primary.length && primary[primaryIndex].time <= time) primaryCurrent = primary[primaryIndex++];
    while (secondaryIndex < secondary.length && secondary[secondaryIndex].time <= time) secondaryCurrent = secondary[secondaryIndex++];
    if (!primaryCurrent || !secondaryCurrent) continue;
    const aPrice = primaryCurrent.close;
    const bPrice = secondaryCurrent.close;
    if (!Number.isFinite(aPrice) || !Number.isFinite(bPrice)) continue;
    const aPct = (aPrice / primaryBase - 1) * 100;
    const bPct = (bPrice / secondaryBase - 1) * 100;
    if (!Number.isFinite(aPct) || !Number.isFinite(bPct)) continue;
    rows.push({
      time,
      date: primaryCurrent.time === time ? primaryCurrent.date : secondaryCurrent.time === time ? secondaryCurrent.date : new Date(time * 1000).toISOString(),
      aPct,
      bPct,
      aPrice,
      bPrice,
      aVolume: primaryCurrent.time === time && Number.isFinite(primaryCurrent.volume) ? primaryCurrent.volume! : null,
      bVolume: secondaryCurrent.time === time && Number.isFinite(secondaryCurrent.volume) ? secondaryCurrent.volume! : null,
    });
  }
  return rows;
}

function ComparisonTooltip({
  active,
  payload,
  primarySymbol,
  secondarySymbol,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ComparisonRow }>;
  primarySymbol: string;
  secondarySymbol: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const dateLabel = new Date(row.time * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="rounded-lg border border-border-subtle bg-panel px-3 py-2 text-xs shadow-xl">
      <p className="mb-2 text-text-muted">{dateLabel}</p>
      <p style={{ color: COMPARISON_COLORS.primary }}>{primarySymbol}: {formatCurrency(row.aPrice)} ({formatPercent(row.aPct)})</p>
      <p style={{ color: COMPARISON_COLORS.secondary }}>{secondarySymbol}: {formatCurrency(row.bPrice)} ({formatPercent(row.bPct)})</p>
    </div>
  );
}

export function ComparisonPriceChart({
  primarySymbol,
  secondarySymbol,
}: {
  primarySymbol: string;
  secondarySymbol: string;
}) {
  const [period, setPeriod] = useState<ChartPeriod>("1M");
  const [primaryCandles, setPrimaryCandles] = useState<CandlePoint[]>([]);
  const [secondaryCandles, setSecondaryCandles] = useState<CandlePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<ComparisonRow | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPrimaryCandles([]);
    setSecondaryCandles([]);
    setHoveredRow(null);
    async function load() {
      try {
        const request = (symbol: string) => fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}&refresh=1`,
          { signal: controller.signal, cache: "no-store" },
        ).then(async (response) => {
          const payload = await response.json() as { candles?: CandlePoint[]; error?: string };
          if (!response.ok) throw new Error(payload.error || `No ${period} candle data for ${symbol}.`);
          return payload.candles ?? [];
        });
        const [a, b] = await Promise.all([request(primarySymbol), request(secondarySymbol)]);
        if (controller.signal.aborted) return;
        setPrimaryCandles(a);
        setSecondaryCandles(b);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Unable to load comparison candles.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [primarySymbol, secondarySymbol, period]);

  const rows = useMemo(() => mergeComparisonCandles(primaryCandles, secondaryCandles), [primaryCandles, secondaryCandles]);
  const yDomain = useMemo<[number, number]>(() => {
    if (!rows.length) return [-1, 1];
    const values = rows.flatMap((row) => [row.aPct, row.bPct]);
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    const padding = Math.max((high - low) * 0.06, 0.5);
    return [low - padding, high + padding];
  }, [rows]);
  const latest = hoveredRow ?? rows[rows.length - 1] ?? null;
  const winnerIsPrimary = latest ? latest.aPct >= latest.bPct : true;
  const volumeMax = useMemo(() => Math.max(1, ...rows.flatMap((row) => [row.aVolume ?? 0, row.bVolume ?? 0])), [rows]);

  const setHoveredFromState = (state: unknown) => {
    const { activeTooltipIndex, isTooltipActive } = (state ?? {}) as { activeTooltipIndex?: number; isTooltipActive?: boolean };
    setHoveredRow(isTooltipActive && activeTooltipIndex !== undefined ? rows[activeTooltipIndex] ?? null : null);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        {latest ? (
          <>
            <div>
              <WheelPrice value={formatPercent(latest.aPct)} size="lg" colorClass={winnerIsPrimary ? "text-purple-400" : "text-purple-400/55"} />
            </div>
            <div>
              <WheelPrice value={formatPercent(latest.bPct)} size="lg" colorClass={!winnerIsPrimary ? "text-orange-400" : "text-orange-400/55"} />
            </div>
            <span className="pb-1 text-xs text-text-muted">{latest.date === "prev" ? "Previous close" : new Date(latest.time * 1000).toLocaleString()}</span>
          </>
        ) : (
          <p className="text-sm text-text-muted">{loading ? "Loading comparison history…" : error ?? "These stocks have no overlapping price history for this period."}</p>
        )}
      </div>

      <div className="relative h-[330px] w-full">
        {loading ? (
          <div className="flex h-full items-end gap-2 rounded-xl border border-border-subtle/50 bg-panel/30 p-6 animate-pulse">
            {Array.from({ length: 22 }, (_, index) => <div key={index} className="flex-1 rounded-t-sm bg-accent/20" style={{ height: `${24 + ((index * 37) % 70)}%` }} />)}
          </div>
        ) : rows.length ? (
          <div className="comparison-stock-chart h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: 12 }} onMouseMove={setHoveredFromState} onMouseLeave={() => setHoveredRow(null)}>
                <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
                <YAxis type="number" domain={yDomain} tickFormatter={(value: number) => `${value.toFixed(0)}%`} stroke="rgba(150,150,150,0.65)" width={44} tick={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="rgba(150,150,150,0.55)" strokeDasharray="4 4" />
                <Tooltip content={<ComparisonTooltip primarySymbol={primarySymbol} secondarySymbol={secondarySymbol} />} />
                <Line
                  className="comparison-series-a"
                  type="monotone" dataKey="aPct" stroke={COMPARISON_COLORS.primary} strokeWidth={2.5} dot={false} isAnimationActive={false}
                  activeDot={(rawProps: unknown) => {
                    const props = rawProps as { cx?: number; cy?: number; payload?: ComparisonRow };
                    if (props.cx == null || props.cy == null || !props.payload || props.payload.aPct < props.payload.bPct) return <g />;
                    return <circle cx={props.cx} cy={props.cy} r={5} fill={COMPARISON_COLORS.primary} stroke="#000" strokeWidth={2} />;
                  }}
                />
                <Line
                  className="comparison-series-b"
                  type="monotone" dataKey="bPct" stroke={COMPARISON_COLORS.secondary} strokeWidth={2.5} dot={false} isAnimationActive={false}
                  activeDot={(rawProps: unknown) => {
                    const props = rawProps as { cx?: number; cy?: number; payload?: ComparisonRow };
                    if (props.cx == null || props.cy == null || !props.payload || props.payload.bPct <= props.payload.aPct) return <g />;
                    return <circle cx={props.cx} cy={props.cy} r={5} fill={COMPARISON_COLORS.secondary} stroke="#000" strokeWidth={2} />;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-border-subtle/50 bg-panel/30 px-6 text-center text-sm text-text-muted">
            {error ?? "These stocks have no overlapping price history for this period. Try another period."}
          </div>
        )}
      </div>

      {rows.length > 0 && (
      <div className="mt-3 h-20 w-full" aria-label="Overlaid comparison volume">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} barCategoryGap="15%" barGap="-100%" margin={{ top: 2, right: 12, bottom: 0, left: 12 }}>
              <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} hide />
              <YAxis domain={[0, volumeMax]} hide />
              <Tooltip content={<ComparisonTooltip primarySymbol={primarySymbol} secondarySymbol={secondarySymbol} />} />
              <Bar dataKey="aVolume" fill={COMPARISON_COLORS.primary} fillOpacity={0.54} maxBarSize={12} isAnimationActive={false} />
              <Bar dataKey="bVolume" fill={COMPARISON_COLORS.secondary} fillOpacity={0.54} maxBarSize={12} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex justify-center">
        <div className="chart-period-selector-glass chart-period-selector-desktop relative hidden flex-nowrap items-center justify-center gap-1 rounded-full border p-1 lg:flex">
          <span className="chart-period-indicator" aria-hidden="true" style={{ transform: `translate(${PERIODS.indexOf(period) * 40}px, 0)` }} />
          {PERIODS.map((option, index) => (
            <button key={option} type="button" onClick={() => setPeriod(option)}
              className={`chart-period-option relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${period === option ? "text-black" : "text-accent hover:text-accent/80"}`}
              onMouseEnter={(event) => { if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) { const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll("button") ?? []); buttons.forEach((button, i) => { button.style.transform = `scale(${Math.abs(i-index) === 0 ? 1.14 : 0.78})`; }); } }}
              onMouseLeave={(event) => { const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll("button") ?? []); buttons.forEach((button) => { button.style.transform = "scale(1)"; }); }}
            >{option}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
