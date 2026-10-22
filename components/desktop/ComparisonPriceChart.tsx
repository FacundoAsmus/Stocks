"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

import { PriceHistoryLoadingAnimation, VolumeChartCanvas, WheelPrice, tooltipLabel } from "@/components/PriceChart";
import { StockLogo } from "@/components/StockLogo";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import { formatPercent } from "@/lib/format";
import { SECTOR_ETFS } from "@/lib/etfs";
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

export function ComparisonPriceChart({
  primarySymbol,
  secondarySymbol,
  primaryName,
  secondaryName,
  primaryLogo,
  secondaryLogo,
  onRemovePrimary,
  onRemoveSecondary,
}: {
  primarySymbol: string;
  secondarySymbol: string;
  primaryName: string;
  secondaryName: string;
  primaryLogo?: string;
  secondaryLogo?: string;
  onRemovePrimary: () => void;
  onRemoveSecondary: () => void;
}) {
  const [period, setPeriod] = useState<ChartPeriod>("1M");
  const [primaryCandles, setPrimaryCandles] = useState<CandlePoint[]>([]);
  const [secondaryCandles, setSecondaryCandles] = useState<CandlePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<ComparisonRow | null>(null);
  const [proMode, setProMode] = useState(() => typeof window !== "undefined" && localStorage.getItem("pro-mode") === "1");
  const [showVolumeChart, setShowVolumeChart] = useState(() => typeof window === "undefined" || localStorage.getItem("pro-volume-chart") !== "0");
  const chartRevealRef = useRef<HTMLDivElement>(null);
  const [chartEntered, setChartEntered] = useState(false);
  const horizontalCrosshairRef = useRef<HTMLDivElement>(null);
  const volumeCrosshairRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChartEntered(false);
    const element = chartRevealRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setChartEntered(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [period]);

  useEffect(() => {
    const syncProMode = () => setProMode(localStorage.getItem("pro-mode") === "1");
    const syncVolume = () => setShowVolumeChart(localStorage.getItem("pro-volume-chart") !== "0");
    window.addEventListener("pro-mode-changed", syncProMode);
    window.addEventListener("pro-volume-chart-changed", syncVolume);
    window.addEventListener("storage", syncProMode);
    window.addEventListener("storage", syncVolume);
    return () => {
      window.removeEventListener("pro-mode-changed", syncProMode);
      window.removeEventListener("pro-volume-chart-changed", syncVolume);
      window.removeEventListener("storage", syncProMode);
      window.removeEventListener("storage", syncVolume);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPrimaryCandles([]);
    setSecondaryCandles([]);
    setHoveredRow(null);
    if (horizontalCrosshairRef.current) horizontalCrosshairRef.current.style.display = "none";
    if (volumeCrosshairRef.current) volumeCrosshairRef.current.style.display = "none";
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
  const comparisonVolumeBuckets = useMemo(() => rows.map(({ aVolume, bVolume }) => ({ aVolume, bVolume })), [rows]);
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

  const setHoveredFromState = (state: unknown) => {
    const { activeTooltipIndex, isTooltipActive, activeCoordinate } = (state ?? {}) as { activeTooltipIndex?: number; isTooltipActive?: boolean; activeCoordinate?: { x?: number; y?: number } };
    setHoveredRow(isTooltipActive && activeTooltipIndex !== undefined ? rows[activeTooltipIndex] ?? null : null);
    if (activeCoordinate?.y !== undefined && horizontalCrosshairRef.current) {
      horizontalCrosshairRef.current.style.top = `${activeCoordinate.y}px`;
      horizontalCrosshairRef.current.style.display = "block";
    }
    if (activeCoordinate?.x !== undefined && volumeCrosshairRef.current) {
      volumeCrosshairRef.current.style.left = `${activeCoordinate.x}px`;
      volumeCrosshairRef.current.style.display = "block";
    }
  };
  const setHoveredFromVolumeIndex = (index: number | null, x: number | null) => {
    setHoveredRow(index === null ? null : rows[index] ?? null);
    if (x !== null && volumeCrosshairRef.current) {
      volumeCrosshairRef.current.style.left = `${x}px`;
      volumeCrosshairRef.current.style.display = "block";
    } else if (volumeCrosshairRef.current) {
      volumeCrosshairRef.current.style.display = "none";
    }
  };
  const clearHovered = () => {
    setHoveredRow(null);
    if (horizontalCrosshairRef.current) horizontalCrosshairRef.current.style.display = "none";
    if (volumeCrosshairRef.current) volumeCrosshairRef.current.style.display = "none";
  };

  return (
    <div>
      <div className="mb-2 space-y-3">
        {([
          [primaryName, primarySymbol, COMPARISON_COLORS.primary, onRemovePrimary],
          [secondaryName, secondarySymbol, COMPARISON_COLORS.secondary, onRemoveSecondary],
        ] as const).map(([name, symbol, identityColor, remove]) => (
              <div key={symbol} className="flex items-center gap-3">
                <button type="button" aria-label={`Show ${name} alone`} title={`Show ${name} alone`} onClick={remove}
                  className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-full transition hover:scale-110 hover:brightness-75">
                  <StockLogo
                    logo={SECTOR_ETFS.some((entry) => entry.symbol === symbol) ? undefined : (symbol === primarySymbol ? primaryLogo : secondaryLogo)}
                    sizeClassName="h-14 w-14"
                    shape="circle"
                  />
                  <OptionalSvgIcon name="close" className="absolute inset-0 m-auto h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" colorClassName="text-black" />
                </button>
                <p className={`min-w-0 truncate text-4xl font-semibold tracking-normal sm:text-5xl ${identityColor === COMPARISON_COLORS.primary ? "text-purple-400" : "text-orange-400"}`}>{name}</p>
              </div>
        ))}
        {!latest && !loading && <p className="text-sm text-text-muted">{error ?? "These stocks have no overlapping price history for this period."}</p>}
        {!loading && latest && <div className="flex items-end gap-3">
          {([
            { series: winnerIsPrimary ? "a" : "b", value: latest ? (winnerIsPrimary ? latest.aPct : latest.bPct) : null, large: true },
            { series: winnerIsPrimary ? "b" : "a", value: latest ? (winnerIsPrimary ? latest.bPct : latest.aPct) : null, large: false },
          ] as const).map(({ series, value, large }) => (
            <motion.div
              key={series}
              layout
              initial={false}
              transition={{ layout: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } }}
              className="flex items-end"
            >
              <WheelPrice
                value={value === null ? "N/A" : formatPercent(value)}
                size={large ? "lg" : "sm"}
                colorClass={series === "a"
                  ? large ? "text-purple-400 transition-colors duration-300" : "text-purple-400/50 transition-colors duration-300"
                  : large ? "text-orange-400 transition-colors duration-300" : "text-orange-400/50 transition-colors duration-300"}
              />
            </motion.div>
          ))}
        </div>}
      </div>
      {!loading && latest && <p className="mb-3 text-sm text-text-muted">{tooltipLabel(latest.date, period)}</p>}

      <style>{`@keyframes comparison-chart-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }`}</style>
      <div ref={chartRevealRef} className="relative h-[384px] w-full">
        {loading ? (
          <PriceHistoryLoadingAnimation />
        ) : rows.length ? (
          <div className="comparison-stock-chart h-full w-full" style={{ animation: chartEntered ? "comparison-chart-reveal 0.7s cubic-bezier(0.4,0,0.2,1) both" : "none", clipPath: chartEntered ? undefined : "inset(0 100% 0 0)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} onMouseMove={setHoveredFromState} onMouseLeave={clearHovered}>
                <XAxis dataKey="date" hide />
                <YAxis type="number" domain={yDomain} hide />
                <ReferenceLine y={0} stroke="rgba(150,150,150,0.55)" strokeDasharray="4 4" />
                <Tooltip content={() => null} cursor={{ stroke: "rgba(128,128,128,0.5)", strokeWidth: 1 }} />
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
            {proMode && <div ref={horizontalCrosshairRef} data-crosshair-h="" className="pointer-events-none absolute inset-x-0 h-px" style={{ background: "rgba(128,128,128,0.5)", display: "none" }} />}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-text-muted">
            {error ?? "These stocks have no overlapping price history for this period. Try another period."}
          </div>
        )}
      </div>

      {showVolumeChart && rows.length > 0 && (
      <div className="relative mt-3 h-20 w-full" aria-label="Overlaid comparison volume">
        <VolumeChartCanvas comparisonBuckets={comparisonVolumeBuckets} onComparisonHover={setHoveredFromVolumeIndex} />
        <div ref={volumeCrosshairRef} data-crosshair-v="" className="pointer-events-none absolute inset-y-0 hidden w-px bg-white/20" />
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
