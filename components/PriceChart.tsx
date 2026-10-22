"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  Customized,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CandlePoint, ChartPeriod } from "@/types/stock";
import { getAlertDeviceId } from "@/lib/priceAlertClient";

const SHORT_PERIODS: ChartPeriod[] = ["1D", "1W", "1M", "2M", "3M", "5M", "6M"];
const LONG_PERIODS:  ChartPeriod[] = ["1Y", "2Y", "5Y", "ALL"];
const LONG_TERM_SET  = new Set<ChartPeriod>(["1Y", "2Y", "5Y", "ALL"]);

// Which moving averages make sense to offer for a given period — a moving
// average that's much longer than the visible window just renders as a
// flat, uninformative line, so it's hidden rather than shown broken.
const MA_AVAILABILITY: Record<ChartPeriod, number[]> = {
  "1D": [],
  "1W": [7],
  "1M": [7, 25],
  "2M": [7, 25],
  "3M": [7, 25, 99],
  "5M": [7, 25, 99],
  "6M": [7, 25, 99],
  "1Y": [7, 25, 99],
  "2Y": [7, 25, 99],
  "5Y": [7, 25, 99],
  "ALL": [7, 25, 99],
};
const MA_COLORS: Record<number, string> = {
  7: "#f59e0b",   // orange-yellowish
  25: "#ec4899",  // pink
  99: "#8b5cf6",  // violet
};

const MAX_VOLUME_BARS = 240;

type VolumeBucket = { volume: number; isUp: boolean };
type SquareRect = { left: number; top: number; width: number; height: number };
type RectangleTrend = "up" | "down";

function getDrawingAreaStyle(trend: RectangleTrend, stroke: string) {
  const horizontalDashes = `repeating-linear-gradient(90deg, ${stroke} 0 8px, transparent 8px 14px)`;
  const verticalDashes = `repeating-linear-gradient(180deg, ${stroke} 0 8px, transparent 8px 14px)`;
  return {
    border: "none",
    borderRadius: "24px",
    backgroundColor: trend === "up" ? "rgba(0,200,5,0.10)" : "rgba(255,48,3,0.10)",
    backgroundImage: `${horizontalDashes}, ${horizontalDashes}, ${verticalDashes}, ${verticalDashes}`,
    backgroundPosition: "top left, bottom left, top left, top right",
    backgroundSize: "100% 1px, 100% 1px, 1px 100%, 1px 100%",
    backgroundRepeat: "repeat-x, repeat-x, repeat-y, repeat-y",
  };
}

function getDrawingRect(anchor: { x: number; y: number }, point: { x: number; y: number }): SquareRect {
  return {
    left: Math.min(anchor.x, point.x),
    top: Math.min(anchor.y, point.y),
    width: Math.abs(point.x - anchor.x),
    height: Math.abs(point.y - anchor.y),
  };
}

export type ComparisonVolumeBucket = { aVolume: number | null; bVolume: number | null };
const EMPTY_VOLUME_BUCKETS: VolumeBucket[] = [];

// Recharts has no built-in OHLC series. This layer uses the chart's actual
// Y-axis scale, rather than approximating it from a bar's zero baseline, so
// every body and wick lands exactly on its open/high/low/close price.
function CandlestickLayer({
  data,
  offset,
  yAxisMap,
}: {
  data?: CandlePoint[];
  offset?: { left: number; width: number };
  yAxisMap?: Record<string, { scale?: (value: number) => number }>;
}) {
  const yScale = Object.values(yAxisMap ?? {})[0]?.scale;
  if (!data?.length || !offset || !yScale) return null;

  const slotWidth = offset.width / data.length;
  const bodyWidth = Math.max(1, Math.min(slotWidth * 0.62, 12));
  return (
    <g className="recharts-candlestick-layer" aria-hidden>
      {data.map((point, index) => {
        const close = point.close;
        const open = point.open ?? close;
        const high = point.high ?? Math.max(open, close);
        const low = point.low ?? Math.min(open, close);
        const openY = yScale(open);
        const closeY = yScale(close);
        const highY = yScale(high);
        const lowY = yScale(low);
        const rising = close >= open;
        const color = rising ? "#00c805" : "#ff3003";
        const centerX = offset.left + (index + 0.5) * slotWidth;
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(openY - closeY), 1);

        return (
          <g key={point.time}>
            <line x1={centerX} x2={centerX} y1={highY} y2={lowY} stroke={color} strokeWidth={1} />
            <rect x={centerX - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

// Long ranges can contain thousands of candles. The volume panel is a visual
// overview, so combine adjacent candles into a bounded number of buckets.
// This keeps rendering work stable without hiding any period of history.
function buildVolumeBuckets(points: CandlePoint[]): VolumeBucket[] {
  let previousClose: number | undefined;
  const volumes = points.flatMap((point) => {
    const volume = point.volume;
    const referencePrice = point.open ?? previousClose ?? point.close;
    previousClose = point.close;
    return typeof volume === "number" && volume > 0
      ? [{ volume, isUp: point.close >= referencePrice }]
      : [];
  });
  if (volumes.length <= MAX_VOLUME_BARS) return volumes;

  const bucketSize = Math.ceil(volumes.length / MAX_VOLUME_BARS);
  const buckets: VolumeBucket[] = [];
  for (let start = 0; start < volumes.length; start += bucketSize) {
    const source = volumes.slice(start, start + bucketSize);
    const volume = source.reduce((sum, entry) => sum + entry.volume, 0);
    const directionalVolume = source.reduce((sum, entry) => sum + (entry.isUp ? entry.volume : -entry.volume), 0);
    buckets.push({ volume, isUp: directionalVolume >= 0 });
  }
  return buckets;
}

export function VolumeChartCanvas({
  buckets = EMPTY_VOLUME_BUCKETS,
  colorBars = false,
  comparisonBuckets,
  onComparisonHover,
}: {
  buckets?: VolumeBucket[];
  colorBars?: boolean;
  comparisonBuckets?: ComparisonVolumeBucket[];
  onComparisonHover?: (index: number | null, x: number | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    // Preserve the narrowed type for the nested draw/ResizeObserver
    // callbacks; Next's type checker does not carry the ref narrowing into
    // those closures automatically.
    const canvas: HTMLCanvasElement = canvasElement;

    function draw(progress = 1) {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      if (comparisonBuckets) {
        const maxVolume = Math.max(1, ...comparisonBuckets.flatMap((bucket) => [bucket.aVolume ?? 0, bucket.bVolume ?? 0]));
        const step = width / comparisonBuckets.length;
        const barWidth = Math.max(1, step * 0.72);
        comparisonBuckets.forEach((bucket, index) => {
          const x = index * step + (step - barWidth) / 2;
          if (bucket.aVolume !== null) {
            const barHeight = Math.max(1, (bucket.aVolume / maxVolume) * height * progress);
            context.fillStyle = "rgba(168, 85, 247, 0.54)";
            context.fillRect(x, height - barHeight, barWidth, barHeight);
          }
          if (bucket.bVolume !== null) {
            const barHeight = Math.max(1, (bucket.bVolume / maxVolume) * height * progress);
            context.fillStyle = "rgba(249, 115, 22, 0.54)";
            context.fillRect(x, height - barHeight, barWidth, barHeight);
          }
        });
        return;
      }

      if (!buckets.length) return;
      const maxVolume = Math.max(...buckets.map((bucket) => bucket.volume), 1);
      const step = width / buckets.length;
      const barWidth = Math.max(1, step * 0.72);
      buckets.forEach((bucket, index) => {
        const barHeight = Math.max(1, (bucket.volume / maxVolume) * height * progress);
        const x = index * step + (step - barWidth) / 2;
        context.fillStyle = colorBars && !bucket.isUp
          ? "rgba(255, 70, 58, 0.22)"
          : "rgba(0, 200, 5, 0.24)";
        context.fillRect(x, height - barHeight, barWidth, barHeight);
      });
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    function animate(now: number) {
      const progress = Math.min(1, (now - startedAt) / 500);
      draw(progress);
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    }
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [buckets, colorBars, comparisonBuckets]);

  return <canvas
    ref={canvasRef}
    className="block h-full w-full"
    aria-hidden
    onMouseMove={comparisonBuckets && onComparisonHover ? (event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const index = Math.min(comparisonBuckets.length - 1, Math.floor((x / bounds.width) * comparisonBuckets.length));
      if (index >= 0) onComparisonHover(index, x);
    } : undefined}
    onMouseLeave={comparisonBuckets && onComparisonHover ? () => onComparisonHover(null, null) : undefined}
  />;
}

export function PriceHistoryLoadingAnimation() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <style>{`
        @keyframes chart-candle-breathe { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(1.4)} }
        @keyframes chart-wick-breathe   { 0%,100%{opacity:0.25;transform:scaleY(0.7)} 50%{opacity:0.9;transform:scaleY(1.3)} }
        .cc-1{animation:chart-candle-breathe 1.8s ease-in-out infinite -1.8s;transform-origin:bottom}
        .cc-2{animation:chart-candle-breathe 1.8s ease-in-out infinite -1.32s;transform-origin:bottom}
        .cc-3{animation:chart-candle-breathe 1.8s ease-in-out infinite -0.84s;transform-origin:bottom}
        .cw-1{animation:chart-wick-breathe 1.8s ease-in-out infinite -1.8s;transform-origin:bottom}
        .cw-2{animation:chart-wick-breathe 1.8s ease-in-out infinite -1.32s;transform-origin:bottom}
        .cw-3{animation:chart-wick-breathe 1.8s ease-in-out infinite -0.84s;transform-origin:bottom}
      `}</style>
      <div className="flex items-end gap-[5px] h-10">
        <div className="flex flex-col items-center gap-[2px]"><div className="cw-1 w-[2px] h-1.5 rounded-full bg-positive/50" /><div className="cc-1 w-3.5 h-4 rounded-sm bg-positive/50" /></div>
        <div className="flex flex-col items-center gap-[2px]"><div className="cw-2 w-[2px] h-2 rounded-full bg-positive/70" /><div className="cc-2 w-3.5 h-6 rounded-sm bg-positive/70" /></div>
        <div className="flex flex-col items-center gap-[2px]"><div className="cw-3 w-[2px] h-2.5 rounded-full bg-positive" /><div className="cc-3 w-3.5 h-8 rounded-sm bg-positive" /></div>
      </div>
      <span className="text-sm text-text-muted">Loading price history</span>
    </div>
  );
}

// `windowDays` is a number of *days*, not points — periods have wildly
// different point granularity (a "5Y" chart's points might each span a
// week, while "1M" points are daily), so a fixed point-count window would
// mean very different real time spans depending on the period. Using a
// time-based sliding window keeps "MA(99)" meaning the same thing — the
// trailing 99 days — regardless of how coarse the underlying data is.
function computeMA(points: CandlePoint[], windowDays: number): (number | null)[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const result: (number | null)[] = new Array(points.length).fill(null);
  if (!points.length) return result;

  const time = (p: CandlePoint) => new Date(p.date === "prev" ? Date.now() : p.date).getTime();
  const firstTime = time(points[0]);

  let start = 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].close;
    const endTime = time(points[i]);
    const windowStart = endTime - windowDays * DAY_MS;
    while (start < i && time(points[start]) < windowStart) {
      sum -= points[start].close;
      start++;
    }
    const count = i - start + 1;
    const hasFullWindow = (endTime - firstTime) >= windowDays * DAY_MS;
    result[i] = hasFullWindow && count > 0 ? sum / count : null;
  }
  return result;
}

/* ─── Date label for tooltip crosshair ──────────────────────────────────── */
export function tooltipLabel(dateStr: string, period: ChartPeriod): string {
  if (dateStr === "prev") return "Yesterday";
  const d = new Date(dateStr);
  if (period === "1D")
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (period === "1W")
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  if (period === "5Y" || period === "ALL")
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (period === "1Y" || period === "2Y")
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── X-axis tick labels ─────────────────────────────────────────────────── */
function xAxisLabel(dateStr: string, period: ChartPeriod): string {
  const d = new Date(dateStr);
  if (period === "1D")
    return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  if (period === "1W")
    return d.toLocaleDateString("en-US", { weekday: "short" });
  if (period === "5Y" || period === "ALL")
    return d.getFullYear().toString();
  if (period === "1Y" || period === "2Y")
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


/* ─── Number-wheel digit ─────────────────────────────────────────────────── */
const DIGIT_CHARS = ["0","1","2","3","4","5","6","7","8","9"];
const WHEEL_SLOT_RATIO = 0.62;

function Digit({ ch, size = "lg", compact = false, animate = true }: { ch: string; size?: "xs" | "badge" | "sm" | "md" | "lg"; compact?: boolean; animate?: boolean }) {
  const isDigit = DIGIT_CHARS.includes(ch);
  const idx     = isDigit ? parseInt(ch) : 0;
  const previousDigitRef = useRef(idx);
  const rollIdRef = useRef(0);
  const [roll, setRoll] = useState<{
    id: number;
    from: number;
    to: number;
    direction: "up" | "down";
  } | null>(null);

  useLayoutEffect(() => {
    if (!isDigit) return;
    if (!animate) {
      previousDigitRef.current = idx;
      setRoll(null);
      return;
    }
    if (previousDigitRef.current === idx) return;

    const previous = previousDigitRef.current;
    const shortestStep = ((idx - previous + 15) % 10) - 5;
    previousDigitRef.current = idx;
    setRoll({
      id: ++rollIdRef.current,
      from: previous,
      to: idx,
      direction: shortestStep >= 0 ? "up" : "down",
    });
  }, [idx, isDigit, animate]);

  const rowPx     = size === "lg" ? 54 : size === "sm" ? 32 : size === "md" ? 30 : 22;
  const fontClass = size === "lg"
    ? "text-5xl font-semibold text-current"
    : size === "sm"
      ? "text-2xl font-medium"
      : size === "md"
        ? "text-xl font-semibold text-current"
        : size === "badge"
          ? "text-sm font-bold text-current"
          : "text-xs font-semibold text-current";

  if (!isDigit) {
    return (
      <span
        className={cn(fontClass, "inline-block leading-none")}
        style={{ lineHeight: `${rowPx}px` }}
      >
        {ch}
      </span>
    );
  }

  const slotPx = Math.round((compact ? 0.49 : WHEEL_SLOT_RATIO) * rowPx);
  const rollingDigits = roll
    ? (roll.direction === "up" ? [roll.from, roll.to] : [roll.to, roll.from])
    : [idx];

  return (
    <span
      className="inline-block overflow-hidden align-bottom"
      style={{
        height: rowPx,
        width: slotPx,
      }}
    >
      <span
        key={roll?.id ?? "settled"}
        className="flex flex-col"
        style={{
          animation: roll
            ? `price-digit-roll-${roll.direction} 280ms cubic-bezier(0.22, 1, 0.36, 1) both`
            : "none",
          willChange: roll ? "transform" : "auto",
        }}
        onAnimationEnd={() => {
          setRoll((activeRoll) => activeRoll?.id === roll?.id ? null : activeRoll);
        }}
      >
        {rollingDigits.map((digit, digitIndex) => (
          <span
            key={digitIndex}
            className={cn(fontClass, "block text-center select-none leading-none")}
            style={{ height: rowPx, lineHeight: `${rowPx}px`, width: slotPx }}
          >
            {digit}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ─── Animated price display (wheels for digits, static for $ . , + - %) ── */
export function WheelPrice({
  value,
  size = "lg",
  colorClass,
  compact = false,
  animate = true,
}: {
  value: string;
  size?: "xs" | "badge" | "sm" | "md" | "lg";
  colorClass?: string;
  /** Tighter digit and punctuation spacing for compact metric readouts. */
  compact?: boolean;
  /** Disable digit rolling while the chart is in manual line-placement mode. */
  animate?: boolean;
}) {
  const chars = value.split("");
  const decimalIndex = chars.lastIndexOf(".");
  const integerEnd = decimalIndex === -1 ? chars.length : decimalIndex;
  const integerDigitCount = chars
    .slice(0, integerEnd)
    .filter((char) => DIGIT_CHARS.includes(char)).length;
  let integerDigitsSeen = 0;
  let fractionalDigitsSeen = 0;

  return (
    <>
      <style>{`
        @keyframes price-digit-roll-up {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        @keyframes price-digit-roll-down {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <span className={cn("inline-flex items-end", colorClass ?? "text-text-primary")} style={{ letterSpacing: compact ? "-0.035em" : undefined }}>
        {chars.map((ch, index) => {
          let key: string;
          if (DIGIT_CHARS.includes(ch)) {
            if (index < integerEnd) {
              // Integer wheels stay anchored from the right, so adding a new
              // thousands/tens digit never turns the decimal point or cents
              // into a different wheel.
              key = `integer-${integerDigitCount - 1 - integerDigitsSeen}`;
              integerDigitsSeen++;
            } else {
              key = `fraction-${fractionalDigitsSeen}`;
              fractionalDigitsSeen++;
            }
          } else if (ch === ".") {
            key = "decimal";
          } else {
            key = `symbol-${index}-${ch}`;
          }
          return <Digit key={key} ch={ch} size={size} compact={compact} animate={animate} />;
        })}
      </span>
    </>
  );
}

/* ─── Custom crosshair tooltip ───────────────────────────────────────────── */
function CrosshairTooltip({
  active,
  payload,
  label,
  period,
  onHover,
  isTouching,
  hideBubble = false,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  period: ChartPeriod;
  onHover: (price: number | null, date: string | null) => void;
  isTouching?: boolean;
  hideBubble?: boolean;
}) {
  const price = payload?.[0]?.value ?? null;
  const date  = label ?? null;

  const prevRef = useRef<{ price: number | null; date: string | null }>({ price: null, date: null });

  useEffect(() => {
    const p = active ? price : null;
    const d = active ? date  : null;
    if (prevRef.current.price !== p || prevRef.current.date !== d) {
      prevRef.current = { price: p, date: d };
      onHover(p, d);
    }
  });

  // On touch devices, hide the bubble when finger is lifted (isTouching=false).
  // On desktop (mouse), always show when active.
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
  const showBubble = !hideBubble && active && price !== null && date && (!isTouchDevice || isTouching);

  if (!showBubble) return null;

  return (
    <div
      className="rounded-md border border-border-subtle bg-panel px-2.5 py-1.5 text-xs text-text-muted pointer-events-none"
      style={{
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
      }}
    >
      {tooltipLabel(date, period)}
    </div>
  );
}

/* ─── Main PriceChart ────────────────────────────────────────────────────── */
export function PriceChart({
  symbol,
  currentPrice,
  currentChangePercent,
  previousClose,
  initialPeriod = "1D",
  heightClassName = "h-[320px]",
  priceIndent,
  hideCursorDateTooltip = false,
  hideMovingAverageControls = false
}: {
  symbol: string;
  currentPrice: number;
  currentChangePercent: number;
  previousClose?: number;
  initialPeriod?: ChartPeriod;
  heightClassName?: string;
  priceIndent?: string;
  hideCursorDateTooltip?: boolean;
  hideMovingAverageControls?: boolean;
}) {
  const [period, setPeriod]           = useState<ChartPeriod>(initialPeriod);
  const [hoveredPeriod, setHoveredPeriod] = useState<ChartPeriod | null>(null);
  const [chartKey, setChartKey]       = useState(0);
  const [data, setData]               = useState<CandlePoint[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [hoverPrice, setHoverPrice]   = useState<number | null>(null);
  const [hoverDate,  setHoverDate]    = useState<string | null>(null);
  const [priceVisible, setPriceVisible] = useState(true);
  const [activeMAs, setActiveMAs] = useState<Set<number>>(new Set());
  const activeMAsRef = useRef(activeMAs);
  // A line is eligible to animate only when it was just enabled (or its
  // period was reloaded). Keeping this per-window prevents one new MA from
  // replaying the already visible MA lines.
  const [pendingMAAnimations, setPendingMAAnimations] = useState<Set<number>>(new Set());
  // Pre-chart candles are fetched only after an MA is selected. They seed the
  // calculation but are never included in `data`, so the chart's timeframe
  // and volume panel stay exactly as the user selected.
  const [maHistory, setMaHistory] = useState<CandlePoint[]>([]);
  const [maHistoryWindow, setMaHistoryWindow] = useState(0);

  useEffect(() => {
    activeMAsRef.current = activeMAs;
  }, [activeMAs]);

  useEffect(() => {
    function toggleExternalMA(event: Event) {
      const detail = (event as CustomEvent<{ symbol: string; window: number }>).detail;
      if (!detail || detail.symbol !== symbol) return;
      const willEnable = !activeMAsRef.current.has(detail.window);
      setPendingMAAnimations((previous) => {
        const next = new Set(previous);
        if (willEnable) next.add(detail.window); else next.delete(detail.window);
        return next;
      });
      setActiveMAs((previous) => {
        const next = new Set(previous);
        if (next.has(detail.window)) next.delete(detail.window); else next.add(detail.window);
        return next;
      });
    }
    function reportMAState(event: Event) {
      const detail = (event as CustomEvent<{ symbol: string }>).detail;
      if (detail?.symbol !== symbol) return;
      window.dispatchEvent(new CustomEvent("watchlist-stock-ma-state", {
        detail: {
          symbol,
          active: [...activeMAsRef.current],
          available: MA_AVAILABILITY[period] ?? [],
        },
      }));
    }
    window.addEventListener("watchlist-stock-ma-toggle", toggleExternalMA);
    window.addEventListener("watchlist-stock-ma-request", reportMAState);
    return () => {
      window.removeEventListener("watchlist-stock-ma-toggle", toggleExternalMA);
      window.removeEventListener("watchlist-stock-ma-request", reportMAState);
    };
  }, [period, symbol]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("watchlist-stock-ma-state", {
      detail: {
        symbol,
        active: [...activeMAs],
        available: MA_AVAILABILITY[period] ?? [],
      },
    }));
  }, [activeMAs, period, symbol]);

  // Buttons currently rendered (includes ones mid-exit-animation) and which
  // of those are actively exiting — kept mounted a bit longer than
  // MA_AVAILABILITY[period] itself so the shrink-out animation can play
  // instead of the button just vanishing instantly.
  const [displayedMAWindows, setDisplayedMAWindows] = useState<number[]>(MA_AVAILABILITY[period] ?? []);
  const [exitingMAWindows, setExitingMAWindows] = useState<Set<number>>(new Set());

  // If the period changes to one that doesn't support a currently-active MA
  // (e.g. switching from 1M to 1W drops MA(25)), drop it rather than leave
  // it toggled on with nothing shown.
  useEffect(() => {
    const allowed = MA_AVAILABILITY[period] ?? [];
    setActiveMAs(prev => {
      const next = new Set([...prev].filter(w => allowed.includes(w)));
      return next.size === prev.size ? prev : next;
    });

    setDisplayedMAWindows(prev => {
      const removed = prev.filter(w => !allowed.includes(w));
      const added   = allowed.filter(w => !prev.includes(w));
      if (removed.length) {
        setExitingMAWindows(ex => new Set([...ex, ...removed]));
        setTimeout(() => {
          setExitingMAWindows(ex => {
            const n = new Set(ex);
            removed.forEach(w => n.delete(w));
            return n;
          });
          setDisplayedMAWindows(cur => cur.filter(w => !removed.includes(w)));
        }, 320);
      }
      if (!added.length && !removed.length) return prev;
      return [...prev, ...added];
    });
  }, [period]);
  const [proMode, setProMode]         = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-mode") === "1" : false
  );
  const [showVolumeChart, setShowVolumeChart] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-volume-chart") !== "0" : true
  );
  const [colorVolumeBars, setColorVolumeBars] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-volume-color-bars") === "1" : false
  );
  const [useCandlesticks, setUseCandlesticks] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("chart-style") === "candles" : false
  );
  const [candleViewRange, setCandleViewRange] = useState<{ start: number; end: number } | null>(null);
  const [candlePanning, setCandlePanning] = useState(false);
  const candlePanRef = useRef<{ pointerId: number; startX: number; startIndex: number; endIndex: number } | null>(null);
  const [showPriceAlertLines, setShowPriceAlertLines] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-alert-lines") === "1" : false
  );
  const [priceAlerts, setPriceAlerts] = useState<Array<{ id: string; symbol: string; price: number }>>([]);
  const [animatingAlertIds, setAnimatingAlertIds] = useState<Set<string>>(() => new Set());
  const lastAlertIdsRef = useRef<Set<string> | null>(null);

  // Keep proMode in sync across tabs and after settings toggle
  useEffect(() => {
    function sync() {
      setProMode(localStorage.getItem("pro-mode") === "1");
    }
    function syncVolumeChart() {
      setShowVolumeChart(localStorage.getItem("pro-volume-chart") !== "0");
    }
    function syncChartStyle() {
      setUseCandlesticks(localStorage.getItem("chart-style") === "candles");
      setCandleViewRange(null);
    }
    function syncVolumeBarColors() {
      setColorVolumeBars(localStorage.getItem("pro-volume-color-bars") === "1");
    }
    window.addEventListener("pro-mode-changed", sync);
    window.addEventListener("pro-volume-chart-changed", syncVolumeChart);
    window.addEventListener("chart-style-changed", syncChartStyle);
    window.addEventListener("pro-volume-color-bars-changed", syncVolumeBarColors);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pro-mode-changed", sync);
      window.removeEventListener("pro-volume-chart-changed", syncVolumeChart);
      window.removeEventListener("chart-style-changed", syncChartStyle);
      window.removeEventListener("pro-volume-color-bars-changed", syncVolumeBarColors);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    function syncAlertLines() { setShowPriceAlertLines(localStorage.getItem("pro-alert-lines") === "1"); }
    window.addEventListener("pro-alert-lines-changed", syncAlertLines);
    window.addEventListener("storage", syncAlertLines);
    return () => {
      window.removeEventListener("pro-alert-lines-changed", syncAlertLines);
      window.removeEventListener("storage", syncAlertLines);
    };
  }, []);

  useEffect(() => {
    function refreshForStockUpdate(event: Event) {
      const symbolFromEvent = (event as CustomEvent<{ symbol?: string }>).detail?.symbol;
      if (symbolFromEvent !== symbol) return;
      setReloadNonce((nonce) => nonce + 1);
    }
    window.addEventListener("stock-data-refreshed", refreshForStockUpdate);
    return () => window.removeEventListener("stock-data-refreshed", refreshForStockUpdate);
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    let animationTimer: number | undefined;
    lastAlertIdsRef.current = null;
    const loadAlerts = () => {
      fetch(`/api/alerts?deviceId=${encodeURIComponent(getAlertDeviceId())}`)
        .then(response => response.ok ? response.json() : null)
        .then(result => {
          if (!cancelled && Array.isArray(result?.alerts)) {
            const currentAlerts = result.alerts.filter((alert: { symbol?: string; price?: number }) => alert.symbol === symbol && Number.isFinite(alert.price)) as Array<{ id: string; symbol: string; price: number }>;
            const nextIds = new Set(currentAlerts.map(alert => alert.id));
            const previousIds = lastAlertIdsRef.current;
            if (previousIds) {
              const addedIds = new Set([...nextIds].filter(id => !previousIds.has(id)));
              if (addedIds.size) {
                setAnimatingAlertIds(previous => new Set([...previous, ...addedIds]));
                if (animationTimer !== undefined) window.clearTimeout(animationTimer);
                animationTimer = window.setTimeout(() => setAnimatingAlertIds(new Set()), 760);
              }
            }
            lastAlertIdsRef.current = nextIds;
            setPriceAlerts(currentAlerts);
          }
        })
        .catch(() => undefined);
    };
    loadAlerts();
    window.addEventListener("price-alerts-updated", loadAlerts);
    window.addEventListener("storage", loadAlerts);
    return () => {
      cancelled = true;
      if (animationTimer !== undefined) window.clearTimeout(animationTimer);
      window.removeEventListener("price-alerts-updated", loadAlerts);
      window.removeEventListener("storage", loadAlerts);
    };
  }, [symbol]);

  /* Load candles */
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setIsLoading(true);
      setError(null);
      setCandleViewRange(null);
      setHoverPrice(null);
      setHoverDate(null);
      setPriceVisible(false);
      setMaHistory([]);
      setMaHistoryWindow(0);
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}&refresh=1`,
          { signal: controller.signal, cache: "no-store" }
        );
        const payload = (await res.json()) as { candles?: CandlePoint[]; error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Unable to load chart data.");
        const candles = payload.candles ?? [];
        if (candles.length && !LONG_TERM_SET.has(period)) {
          const todayPrefix = new Date().toISOString().slice(0, 10);
          const last  = candles[candles.length - 1];
          if (!last.date.startsWith(todayPrefix)) {
            const liveRes   = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbol)}&refresh=1`, { signal: controller.signal, cache: "no-store" });
            const liveData  = (await liveRes.json()) as { stocks?: { price: number }[] };
            const livePrice = liveData.stocks?.[0]?.price;
            if (livePrice) candles.push({ date: new Date().toISOString(), time: Date.now() / 1000, close: livePrice });
          }
        }
        // For 1D: prepend yesterday's close as the first data point
        // Uses quote.pc (previousClose prop) — same technique as watchlist StockCard
        if (period === "1D" && previousClose && previousClose > 0 && candles.length > 0) {
          const prevPoint: CandlePoint = {
            date: "prev",
            time: candles[0].time - 1,
            close: previousClose,
          };
          setData([prevPoint, ...candles]);
        } else {
          setData(candles);
        }
        setChartKey((key) => key + 1);
        // Small delay so digits have settled before fading back in
        setTimeout(() => setPriceVisible(true), 40);

      } catch (err) {
        if (!controller.signal.aborted) {
          setData([]);
          setError(err instanceof Error ? err.message : "Unable to load chart data.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, reloadNonce, symbol]);

  // Fetch only the missing lead-in data when an MA is switched on. A larger
  // selected MA replaces a smaller cached window; switching an MA off never
  // causes another request.
  const requiredMAHistoryDays = activeMAs.size ? Math.max(...activeMAs) : 0;
  useEffect(() => {
    if (!requiredMAHistoryDays || !data.length || maHistoryWindow >= requiredMAHistoryDays) return;

    const controller = new AbortController();
    const firstVisibleTime = data[0].time;
    async function loadMAHistory() {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}&before=${firstVisibleTime}&historyDays=${requiredMAHistoryDays}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const payload = (await res.json()) as { candles?: CandlePoint[] };
        if (!res.ok) return;
        if (!controller.signal.aborted) {
          setMaHistory((payload.candles ?? []).filter((point) => point.time < firstVisibleTime));
          setMaHistoryWindow(requiredMAHistoryDays);
          // A time-scale change starts with a fresh visible chart and then
          // mounts enabled MAs once their matching lead-in data is ready.
          setPendingMAAnimations((previous) => new Set([...previous, ...activeMAsRef.current]));
        }
      } catch {
        // The price chart remains usable if its optional MA lead-in fails.
      }
    }
    loadMAHistory();
    return () => controller.abort();
  }, [data, maHistoryWindow, period, requiredMAHistoryDays, symbol]);

  // Do not mount an MA line until the requested lead-in candles have arrived.
  // This prevents a partial line from drawing first and then re-animating
  // after its missing beginning has been loaded.
  const renderedMAs = useMemo(
    () => new Set([...activeMAs].filter((window) => maHistoryWindow >= window)),
    [activeMAs, maHistoryWindow]
  );

  const hasData    = data.length > 1;
  const hasVolume  = data.some((point) => typeof point.volume === "number" && point.volume > 0);
  const visibleRange = useMemo(() => {
    if (!useCandlesticks || !data.length || !candleViewRange) return { start: 0, end: data.length };
    const start = Math.max(0, Math.min(data.length - 1, candleViewRange.start));
    const end = Math.max(start + 1, Math.min(data.length, candleViewRange.end));
    return { start, end };
  }, [candleViewRange, data.length, useCandlesticks]);
  const visibleData = useMemo(() => data.slice(visibleRange.start, visibleRange.end), [data, visibleRange]);
  const volumeBuckets = useMemo(() => buildVolumeBuckets(visibleData), [visibleData]);
  const isLongTerm = LONG_TERM_SET.has(period);
  // Keep the price graph's vertical scale independent from indicators. An MA
  // can leave this range, but it must never compress or stretch stock prices.
  const priceYDomain = useMemo<[number, number]>(() => {
    const prices = visibleData.flatMap((point) => useCandlesticks
      ? [point.low ?? point.close, point.high ?? point.close]
      : [point.close]
    ).filter(Number.isFinite);
    if (!prices.length) return [0, 1];
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    if (low !== high) return [low, high];
    const padding = Math.max(Math.abs(low) * 0.01, 1);
    return [low - padding, high + padding];
  }, [visibleData, useCandlesticks]);

  // Merge in MA fields for whichever windows are both available for this
  // period and currently toggled on. Only computed when needed.
  const chartData = useMemo(() => {
    if (!renderedMAs.size) return data;
    // Calculate over the hidden lead-in candles plus the visible range, then
    // map results back onto only the visible points.
    const calculationPoints = [...maHistory, ...data]
      .sort((a, b) => a.time - b.time)
      .filter((point, index, points) => index === 0 || points[index - 1].time !== point.time);
    const mas = new Map([...renderedMAs].map(w => [w, computeMA(calculationPoints, w)]));
    const maValuesByTime = new Map(
      calculationPoints.map((point, index) => [
        point.time,
        { ma7: mas.get(7)?.[index], ma25: mas.get(25)?.[index], ma99: mas.get(99)?.[index] },
      ])
    );
    return data.map((d) => ({
      ...d,
      ma7:  maValuesByTime.get(d.time)?.ma7  ?? undefined,
      ma25: maValuesByTime.get(d.time)?.ma25 ?? undefined,
      ma99: maValuesByTime.get(d.time)?.ma99 ?? undefined,
    }));
  }, [data, maHistory, renderedMAs]);
  const visibleChartData = useMemo(
    () => chartData.slice(visibleRange.start, visibleRange.end),
    [chartData, visibleRange]
  );

  /* Displayed price and % change — hover overrides live values */
  const displayPrice = hoverPrice ?? currentPrice;
  const startPrice   = hasData ? data[0].close : currentPrice;
  const endPrice     = hasData ? data[data.length - 1].close : currentPrice;
  // When not hovering: show pct change across the full visible period (data[0] → latest)
  // When hovering: show pct from period start to hovered point
  const displayPct   = hasData
    ? ((( hoverPrice ?? endPrice) - startPrice) / startPrice) * 100
    : currentChangePercent;

  const isPositive = useMemo(() => {
    if (!hasData) return (currentChangePercent ?? 0) >= 0;
    return (hoverPrice ?? data[data.length - 1].close) >= data[0].close;
  }, [data, hasData, hoverPrice, currentChangePercent]);

  const lineColor   = isPositive ? "#00c805" : "#ff3003";
  const pctColor    = displayPct >= 0 ? "text-positive" : "text-negative";
  const pctSign     = displayPct >= 0 ? "+" : "";

  /* Format strings for wheels */
  const priceStr = formatPrice(displayPrice);
  const pctStr   = `${pctSign}${displayPct.toFixed(2)}%`;

  // suppressRef: when true, CrosshairTooltip's onHover calls are ignored for one frame.
  const suppressRef = useRef(false);
  // isTouching: true only while a finger is actively on the chart
  const [isTouching, setIsTouching] = useState(false);
  // touchOverlay: the computed X% and Y% for the custom dot/crosshair overlay (touch only)
  const [touchOverlay, setTouchOverlay] = useState<{ xPct: number; yPct: number } | null>(null);
  const volumeCrosshairRef = useRef<HTMLDivElement>(null);
  const [linePlacementActive, setLinePlacementActive] = useState(false);
  const [squarePlacementActive, setSquarePlacementActive] = useState(false);
  const [diagonalPlacementActive, setDiagonalPlacementActive] = useState(false);
  const [manualSquares, setManualSquares] = useState<Array<{ id: number; x1: number; x2: number; y1: number; y2: number; trend: RectangleTrend }>>([]);
  const [manualDiagonals, setManualDiagonals] = useState<Array<{ id: number; x1: number; x2: number; y1: number; y2: number }>>([]);
  const [selectedManualSquareId, setSelectedManualSquareId] = useState<number | null>(null);
  const [selectedManualDiagonalId, setSelectedManualDiagonalId] = useState<number | null>(null);
  const squareStartRef = useRef<{ x: number; y: number } | null>(null);
  const squarePreviewRef = useRef<HTMLDivElement>(null);
  const nextSquareId = useRef(1);
  const diagonalStartRef = useRef<{ x: number; y: number } | null>(null);
  const diagonalPreviewRef = useRef<SVGLineElement>(null);
  const nextDiagonalId = useRef(1);

  // This is deliberately a direct DOM update: pointer movement should never
  // cause React to redraw a price chart or hundreds of volume bars.
  const positionVolumeCrosshair = useCallback((percentage: number | null) => {
    const line = volumeCrosshairRef.current;
    if (!line) return;
    if (percentage === null || linePlacementActive || squarePlacementActive || diagonalPlacementActive) {
      line.style.display = "none";
      return;
    }
    line.style.display = "block";
    line.style.left = `${Math.max(0, Math.min(100, percentage))}%`;
  }, [diagonalPlacementActive, linePlacementActive, squarePlacementActive]);
  // Updated from the committed active-dot ref so pointer movement does not
  // schedule a React render for the horizontal crosshair.
  const proCrosshairRef = useRef<HTMLDivElement>(null);
  const [lineCursorPrice, setLineCursorPrice] = useState<number | null>(null);
  const [lineTypedValue, setLineTypedValue] = useState<string | null>(null);
  const [manualPriceLines, setManualPriceLines] = useState<Array<{ id: number; price: number }>>([]);
  const [selectedManualLineId, setSelectedManualLineId] = useState<number | null>(null);
  const nextManualLineId = useRef(1);

  useEffect(() => {
    if (!linePlacementActive && !squarePlacementActive && !diagonalPlacementActive) return;
    setHoverPrice(null);
    setHoverDate(null);
    setTouchOverlay(null);
    positionVolumeCrosshair(null);
    if (proCrosshairRef.current) proCrosshairRef.current.style.display = "none";
  }, [diagonalPlacementActive, linePlacementActive, squarePlacementActive, positionVolumeCrosshair]);

  useEffect(() => {
    if (!hideMovingAverageControls) return;
    function syncLineMode(event: Event) {
      const detail = (event as CustomEvent<{ symbol: string; active: boolean }>).detail;
      if (detail?.symbol !== symbol) return;
      setLinePlacementActive(detail.active);
      setLineTypedValue(null);
      setSquarePlacementActive(false);
      setDiagonalPlacementActive(false);
      squareStartRef.current = null;
      diagonalStartRef.current = null;
      if (squarePreviewRef.current) squarePreviewRef.current.style.display = "none";
      if (diagonalPreviewRef.current) diagonalPreviewRef.current.style.display = "none";
      if (detail.active) {
        setSelectedManualLineId(null);
        setSelectedManualSquareId(null);
        setSelectedManualDiagonalId(null);
      }
      window.dispatchEvent(new CustomEvent("watchlist-stock-line-state", { detail: { symbol, active: detail.active } }));
    }
    window.addEventListener("watchlist-stock-line-mode", syncLineMode);
    function syncSquareMode(event: Event) {
      const detail = (event as CustomEvent<{ symbol: string; active: boolean }>).detail;
      if (detail?.symbol !== symbol) return;
      setSquarePlacementActive(detail.active);
      setLinePlacementActive(false);
      setLineTypedValue(null);
      setDiagonalPlacementActive(false);
      squareStartRef.current = null;
      diagonalStartRef.current = null;
      if (squarePreviewRef.current) squarePreviewRef.current.style.display = "none";
      if (diagonalPreviewRef.current) diagonalPreviewRef.current.style.display = "none";
      if (detail.active) {
        setSelectedManualLineId(null);
        setSelectedManualSquareId(null);
        setSelectedManualDiagonalId(null);
      }
      window.dispatchEvent(new CustomEvent("watchlist-stock-square-state", { detail: { symbol, active: detail.active } }));
    }
    window.addEventListener("watchlist-stock-square-mode", syncSquareMode);
    function syncDiagonalMode(event: Event) {
      const detail = (event as CustomEvent<{ symbol: string; active: boolean }>).detail;
      if (detail?.symbol !== symbol) return;
      setDiagonalPlacementActive(detail.active);
      setLinePlacementActive(false);
      setSquarePlacementActive(false);
      setLineTypedValue(null);
      squareStartRef.current = null;
      diagonalStartRef.current = null;
      if (squarePreviewRef.current) squarePreviewRef.current.style.display = "none";
      if (diagonalPreviewRef.current) diagonalPreviewRef.current.style.display = "none";
      if (detail.active) {
        setSelectedManualLineId(null);
        setSelectedManualSquareId(null);
        setSelectedManualDiagonalId(null);
      }
    }
    window.addEventListener("watchlist-stock-diagonal-mode", syncDiagonalMode);
    function clearManualLines(event: Event) {
      const detail = (event as CustomEvent<{ symbol: string }>).detail;
      if (detail?.symbol !== symbol) return;
      setManualPriceLines([]);
      setManualSquares([]);
      setManualDiagonals([]);
      setSelectedManualLineId(null);
      setSelectedManualSquareId(null);
      setSelectedManualDiagonalId(null);
      setLineTypedValue(null);
      setLinePlacementActive(false);
      setSquarePlacementActive(false);
      setDiagonalPlacementActive(false);
      squareStartRef.current = null;
      diagonalStartRef.current = null;
      if (squarePreviewRef.current) squarePreviewRef.current.style.display = "none";
      if (diagonalPreviewRef.current) diagonalPreviewRef.current.style.display = "none";
      window.dispatchEvent(new CustomEvent("watchlist-stock-line-state", { detail: { symbol, active: false } }));
      window.dispatchEvent(new CustomEvent("watchlist-stock-square-state", { detail: { symbol, active: false } }));
      window.dispatchEvent(new CustomEvent("watchlist-stock-diagonal-state", { detail: { symbol, active: false } }));
    }
    window.addEventListener("watchlist-stock-lines-clear", clearManualLines);
    return () => {
      window.removeEventListener("watchlist-stock-line-mode", syncLineMode);
      window.removeEventListener("watchlist-stock-square-mode", syncSquareMode);
      window.removeEventListener("watchlist-stock-diagonal-mode", syncDiagonalMode);
      window.removeEventListener("watchlist-stock-lines-clear", clearManualLines);
    };
  }, [hideMovingAverageControls, symbol]);

  useEffect(() => {
    if (!linePlacementActive && !squarePlacementActive && !diagonalPlacementActive && selectedManualLineId === null && selectedManualSquareId === null && selectedManualDiagonalId === null) return;
    function handleLineKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        if (squarePlacementActive) {
          event.preventDefault();
          setSquarePlacementActive(false);
          squareStartRef.current = null;
          if (squarePreviewRef.current) squarePreviewRef.current.style.display = "none";
          window.dispatchEvent(new CustomEvent("watchlist-stock-square-state", { detail: { symbol, active: false } }));
          return;
        }
        if (diagonalPlacementActive) {
          event.preventDefault();
          setDiagonalPlacementActive(false);
          diagonalStartRef.current = null;
          if (diagonalPreviewRef.current) diagonalPreviewRef.current.style.display = "none";
          window.dispatchEvent(new CustomEvent("watchlist-stock-diagonal-state", { detail: { symbol, active: false } }));
          return;
        }
        if (!linePlacementActive) return;
        event.preventDefault();
        if (lineTypedValue !== null) {
          setLineTypedValue(null);
          return;
        }
        setLinePlacementActive(false);
        window.dispatchEvent(new CustomEvent("watchlist-stock-line-state", { detail: { symbol, active: false } }));
        return;
      }
      if (event.key === "Enter" && linePlacementActive && lineTypedValue !== null) {
        const typedPrice = Number(lineTypedValue);
        if (Number.isFinite(typedPrice) && typedPrice > 0) {
          event.preventDefault();
          setManualPriceLines((previous) => [...previous, { id: nextManualLineId.current++, price: typedPrice }]);
          setSelectedManualLineId(null);
          setSelectedManualSquareId(null);
          setLinePlacementActive(false);
          setLineTypedValue(null);
          window.dispatchEvent(new CustomEvent("watchlist-stock-line-state", { detail: { symbol, active: false } }));
        }
        return;
      }
      if (!linePlacementActive && (event.key === "Delete" || event.key === "Backspace") && selectedManualLineId !== null) {
        event.preventDefault();
        setManualPriceLines((previous) => previous.filter((line) => line.id !== selectedManualLineId));
          setSelectedManualLineId(null);
          setSelectedManualSquareId(null);
        return;
      }
      if (!linePlacementActive && !squarePlacementActive && (event.key === "Delete" || event.key === "Backspace") && selectedManualSquareId !== null) {
        event.preventDefault();
        setManualSquares((previous) => previous.filter((square) => square.id !== selectedManualSquareId));
        setSelectedManualSquareId(null);
        return;
      }
      if (!linePlacementActive && !squarePlacementActive && !diagonalPlacementActive && (event.key === "Delete" || event.key === "Backspace") && selectedManualDiagonalId !== null) {
        event.preventDefault();
        setManualDiagonals((previous) => previous.filter((diagonal) => diagonal.id !== selectedManualDiagonalId));
        setSelectedManualDiagonalId(null);
        return;
      }
      if (!linePlacementActive) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        setLineTypedValue((previous) => `${previous ?? ""}${event.key}`);
      } else if (event.key === "." || event.key === ",") {
        event.preventDefault();
        setLineTypedValue((previous) => {
          const current = previous ?? "";
          return current.includes(".") ? current : `${current || "0"}.`;
        });
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setLineTypedValue((previous) => previous?.slice(0, -1) || null);
      }
    }
    window.addEventListener("keydown", handleLineKeys);
    return () => window.removeEventListener("keydown", handleLineKeys);
  }, [diagonalPlacementActive, linePlacementActive, lineTypedValue, selectedManualDiagonalId, selectedManualLineId, selectedManualSquareId, squarePlacementActive, symbol]);

  const onHover = useCallback((price: number | null, date: string | null) => {
    if (suppressRef.current || linePlacementActive || squarePlacementActive || diagonalPlacementActive || useCandlesticks) return;
    setHoverPrice(price);
    setHoverDate(date);
  }, [diagonalPlacementActive, linePlacementActive, squarePlacementActive, useCandlesticks]);

  const clearHover = useCallback(() => {
    suppressRef.current = true;
    setIsTouching(false);
    setTouchOverlay(null);
    positionVolumeCrosshair(null);
    setHoverPrice(null);
    setHoverDate(null);
    requestAnimationFrame(() => requestAnimationFrame(() => { suppressRef.current = false; }));
  }, [positionVolumeCrosshair]);

  // dataRef always holds the latest data so touch handlers (attached once) can read it
  const dataRef = useRef<CandlePoint[]>([]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Keep chart touch tracking local to the active gesture. Page scrolling is
  // prevented by touch-action on the chart itself rather than a global
  // preventDefault listener, which could remain stuck if iOS misses touchend.
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onWheel = (event: WheelEvent) => {
      if (!useCandlesticks || data.length < 2 || event.deltaY === 0 || linePlacementActive || squarePlacementActive || diagonalPlacementActive) return;
      event.preventDefault();
      const count = visibleRange.end - visibleRange.start;
      const minimumCount = Math.min(8, data.length);
      const nextCount = Math.max(minimumCount, Math.min(data.length, Math.round(count * (event.deltaY < 0 ? 0.8 : 1.25))));
      if (nextCount === count) return;
      if (nextCount >= data.length) {
        setCandleViewRange(null);
        return;
      }
      const bounds = chart.getBoundingClientRect();
      const pointerRatio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
      const focusIndex = visibleRange.start + pointerRatio * Math.max(0, count - 1);
      const start = Math.max(0, Math.min(data.length - nextCount, Math.round(focusIndex - pointerRatio * (nextCount - 1))));
      setCandleViewRange({ start, end: start + nextCount });
    };
    chart.addEventListener("wheel", onWheel, { passive: false });
    return () => chart.removeEventListener("wheel", onWheel);
  }, [data.length, diagonalPlacementActive, linePlacementActive, squarePlacementActive, useCandlesticks, visibleRange]);

  const updateSquarePreview = useCallback((clientX: number, clientY: number, bounds: DOMRect) => {
    const anchor = squareStartRef.current;
    const preview = squarePreviewRef.current;
    if (!anchor || !preview) return;
    const point = {
      x: Math.max(0, Math.min(bounds.width, clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, clientY - bounds.top)),
    };
    const rect = getDrawingRect(anchor, point);
    preview.style.display = "block";
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    preview.style.height = `${rect.height}px`;
    Object.assign(preview.style, getDrawingAreaStyle(point.y <= anchor.y ? "up" : "down", "#858585"));
  }, []);

  const updateDiagonalPreview = useCallback((clientX: number, clientY: number, bounds: DOMRect) => {
    const anchor = diagonalStartRef.current;
    const preview = diagonalPreviewRef.current;
    if (!anchor || !preview) return;
    preview.setAttribute("x2", `${Math.max(0, Math.min(bounds.width, clientX - bounds.left))}`);
    preview.setAttribute("y2", `${Math.max(0, Math.min(bounds.height, clientY - bounds.top))}`);
    preview.style.display = "block";
  }, []);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    // Given a clientX, find the closest data point and update hover + overlay state
    const updateFromClientX = (clientX: number) => {
      const pts = dataRef.current;
      if (!pts.length) return;
      const rect = el.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const xPct = (clampedX - rect.left) / rect.width;
      const idx  = Math.round(xPct * (pts.length - 1));
      const pt   = pts[Math.max(0, Math.min(pts.length - 1, idx))];

      const prices = pts.map(p => p.close);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const yPct = maxP === minP ? 0.5 : 1 - (pt.close - minP) / (maxP - minP);

      suppressRef.current = true;
      setHoverPrice(pt.close);
      setHoverDate(pt.date);
      setTouchOverlay({ xPct, yPct });
      positionVolumeCrosshair(xPct * 100);
      requestAnimationFrame(() => { suppressRef.current = false; });
    };

    const onTouchMove = (e: TouchEvent) => {
      updateFromClientX(e.touches[0].clientX);
    };

    function onTouchEnd() {
      // Remove the per-gesture listeners
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("blur", onTouchEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearHover();
    }

    function onVisibilityChange() {
      if (document.hidden) onTouchEnd();
    }

    const onTouchStart = (e: TouchEvent) => {
      setIsTouching(true);
      updateFromClientX(e.touches[0].clientX);

      // Attach move/end listeners only for this gesture — removed in onTouchEnd
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onTouchEnd);
      document.addEventListener("touchcancel", onTouchEnd);
      window.addEventListener("blur", onTouchEnd);
      document.addEventListener("visibilitychange", onVisibilityChange);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      // Clean up in case component unmounts mid-gesture
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("blur", onTouchEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clearHover, positionVolumeCrosshair]);

  function renderPeriodButton({ option, index, desktop = false, key }: { option: ChartPeriod; index: number; desktop?: boolean; key: string }) {
    const active = period === option;
    const hoveredIndex = hoveredPeriod === null ? -1 : [...SHORT_PERIODS, ...LONG_PERIODS].indexOf(hoveredPeriod);
    const distanceFromHovered = hoveredIndex < 0 ? -1 : Math.abs(hoveredIndex - index);
    const hoverScale = desktop && hoveredIndex >= 0
      ? distanceFromHovered === 0 ? 1.14 : 0.78
      : 1;
    return (
      <button
        key={key}
        type="button"
        onClick={() => { if (active) return; setPeriod(option); setChartKey(k => k + 1); }}
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) setHoveredPeriod(option);
        }}
        className={cn(
          "chart-period-option relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition",
          active ? "text-black" : "text-accent hover:text-accent/80"
        )}
        style={{ transform: `scale(${hoverScale})` }}
      >
        {option}
      </button>
    );
  }

  return (
    <div>
      {/* ── Price header — indented to align with name when priceIndent is set ── */}
      <div className="mb-6 price-block-fade" style={{ ...(priceIndent ? { paddingLeft: priceIndent } : {}), opacity: priceVisible ? 1 : 0, transition: "opacity 0.18s ease", WebkitTransition: "opacity 0.18s ease" }}>
        <div className="flex items-end gap-3">
          <WheelPrice value={priceStr} size="lg" animate={!linePlacementActive && !squarePlacementActive && !diagonalPlacementActive} />
          <WheelPrice value={pctStr} size="sm" colorClass={pctColor} animate={!linePlacementActive && !squarePlacementActive && !diagonalPlacementActive} />
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {hoverDate ? tooltipLabel(hoverDate, period) : "Current price"}
        </p>
      </div>

      {/* ── Chart area ────────────────────────────────────────────────── */}
      <div
        ref={chartRef}
        className={cn(heightClassName, "relative", isPositive ? "stock-chart-positive" : "stock-chart-negative", useCandlesticks && (candlePanning ? "cursor-grabbing" : "cursor-grab"))}
        style={{ touchAction: "none" }}
        onContextMenu={(event) => {
          if (!hideMovingAverageControls || !window.matchMedia("(min-width: 1024px)").matches) return;
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("watchlist-stock-chart-context-menu", {
            detail: { symbol, clientX: event.clientX, clientY: event.clientY },
          }));
        }}
        onPointerDown={(event) => {
          if (!useCandlesticks || event.pointerType !== "mouse" || event.button !== 0 || data.length < 2 || linePlacementActive || squarePlacementActive || diagonalPlacementActive) return;
          const target = event.target as Element;
          if (target.closest("button, input, textarea, select, a, [role='button'], [data-drawing-hit]")) return;
          candlePanRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startIndex: visibleRange.start,
            endIndex: visibleRange.end,
          };
          setCandlePanning(true);
        }}
        onPointerMove={(event) => {
          const pan = candlePanRef.current;
          if (!useCandlesticks || !pan || pan.pointerId !== event.pointerId) return;
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            const movedX = event.clientX - pan.startX;
            if (Math.abs(movedX) < 3) return;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          const count = pan.endIndex - pan.startIndex;
          const offset = Math.round(((pan.startX - event.clientX) / Math.max(1, bounds.width)) * count);
          const start = Math.max(0, Math.min(data.length - count, pan.startIndex + offset));
          setCandleViewRange({ start, end: start + count });
        }}
        onPointerUp={(event) => {
          if (candlePanRef.current?.pointerId !== event.pointerId) return;
          candlePanRef.current = null;
          setCandlePanning(false);
        }}
        onPointerCancel={() => { candlePanRef.current = null; setCandlePanning(false); }}
        onLostPointerCapture={() => { candlePanRef.current = null; setCandlePanning(false); }}
        onMouseMove={(event) => {
          if (candlePanRef.current) return;
          if (squarePlacementActive) {
            updateSquarePreview(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
            return;
          }
          if (diagonalPlacementActive) {
            updateDiagonalPreview(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
            return;
          }
          if (linePlacementActive) {
            const bounds = event.currentTarget.getBoundingClientRect();
            const plotTop = 8;
            const y = Math.max(plotTop, Math.min(bounds.height, event.clientY - bounds.top));
            const fraction = (y - plotTop) / Math.max(1, bounds.height - plotTop);
            setLineCursorPrice(priceYDomain[1] - fraction * (priceYDomain[1] - priceYDomain[0]));
            return;
          }
          if (useCandlesticks) {
            const bounds = event.currentTarget.getBoundingClientRect();
            const fraction = Math.max(0, Math.min(1, (event.clientY - bounds.top - 8) / Math.max(1, bounds.height - 8)));
            const cursorPrice = priceYDomain[1] - fraction * (priceYDomain[1] - priceYDomain[0]);
            const visibleCount = Math.max(1, visibleRange.end - visibleRange.start);
            const xRatio = Math.max(0, Math.min(0.999999, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
            const candle = data[Math.min(data.length - 1, visibleRange.start + Math.floor(xRatio * visibleCount))];
            setHoverPrice(cursorPrice);
            setHoverDate(candle?.date ?? null);
            if (proCrosshairRef.current && proMode) {
              proCrosshairRef.current.style.display = "block";
              proCrosshairRef.current.style.top = `${event.clientY - bounds.top}px`;
            }
            return;
          }
          // Phones retain the direct pointer position used by their custom
          // touch/hover treatment. Desktop is updated from Recharts below,
          // so both guides use the exact same snapped chart coordinate.
          if (window.matchMedia("(min-width: 1024px)").matches) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          positionVolumeCrosshair(((event.clientX - bounds.left) / bounds.width) * 100);
        }}
        onClick={(event) => {
          if (squarePlacementActive) {
            const bounds = event.currentTarget.getBoundingClientRect();
            const point = {
              x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
              y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
            };
            const anchor = squareStartRef.current;
            if (!anchor) {
              squareStartRef.current = point;
              const preview = squarePreviewRef.current;
              if (preview) {
                preview.style.display = "block";
                preview.style.left = `${point.x}px`;
                preview.style.top = `${point.y}px`;
                preview.style.width = "0px";
                preview.style.height = "0px";
                Object.assign(preview.style, getDrawingAreaStyle("up", "#858585"));
              }
              return;
            }
            const rect = getDrawingRect(anchor, point);
            if (rect.width >= 2 && rect.height >= 2) {
              const visibleCount = Math.max(1, visibleRange.end - visibleRange.start);
              const toIndex = (x: number) => visibleRange.start + (x / Math.max(1, bounds.width)) * visibleCount;
              const toPrice = (y: number) => {
                const fraction = Math.max(0, Math.min(1, (y - 8) / Math.max(1, bounds.height - 8)));
                return priceYDomain[1] - fraction * (priceYDomain[1] - priceYDomain[0]);
              };
              setManualSquares((previous) => [...previous, {
                id: nextSquareId.current++,
                x1: toIndex(anchor.x),
                x2: toIndex(point.x),
                y1: toPrice(anchor.y),
                y2: toPrice(point.y),
                trend: point.y <= anchor.y ? "up" : "down",
              }]);
              setSelectedManualDiagonalId(null);
            }
            squareStartRef.current = null;
            if (squarePreviewRef.current) squarePreviewRef.current.style.display = "none";
            setSquarePlacementActive(false);
            window.dispatchEvent(new CustomEvent("watchlist-stock-square-state", { detail: { symbol, active: false } }));
            return;
          }
          if (diagonalPlacementActive) {
            const bounds = event.currentTarget.getBoundingClientRect();
            const point = {
              x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
              y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
            };
            const anchor = diagonalStartRef.current;
            const preview = diagonalPreviewRef.current;
            if (!anchor) {
              diagonalStartRef.current = point;
              if (preview) {
                preview.setAttribute("x1", `${point.x}`);
                preview.setAttribute("y1", `${point.y}`);
                preview.setAttribute("x2", `${point.x}`);
                preview.setAttribute("y2", `${point.y}`);
                preview.style.display = "block";
              }
              return;
            }
            const visibleCount = Math.max(1, visibleRange.end - visibleRange.start);
            const toIndex = (x: number) => visibleRange.start + (x / Math.max(1, bounds.width)) * visibleCount;
            const toPrice = (y: number) => {
              const fraction = Math.max(0, Math.min(1, (y - 8) / Math.max(1, bounds.height - 8)));
              return priceYDomain[1] - fraction * (priceYDomain[1] - priceYDomain[0]);
            };
            if (Math.hypot(point.x - anchor.x, point.y - anchor.y) >= 4) {
              setManualDiagonals((previous) => [...previous, {
                id: nextDiagonalId.current++,
                x1: toIndex(anchor.x),
                x2: toIndex(point.x),
                y1: toPrice(anchor.y),
                y2: toPrice(point.y),
              }]);
              setSelectedManualDiagonalId(null);
            }
            diagonalStartRef.current = null;
            if (preview) preview.style.display = "none";
            setDiagonalPlacementActive(false);
            window.dispatchEvent(new CustomEvent("watchlist-stock-diagonal-state", { detail: { symbol, active: false } }));
            return;
          }
          if (!linePlacementActive) return;
          const typedPrice = lineTypedValue === null ? NaN : Number(lineTypedValue);
          const price = Number.isFinite(typedPrice) ? typedPrice : lineCursorPrice;
          if (price !== null && Number.isFinite(price) && price > 0) {
            setManualPriceLines((previous) => [...previous, { id: nextManualLineId.current++, price }]);
          }
            setSelectedManualLineId(null);
            setSelectedManualSquareId(null);
          setLinePlacementActive(false);
          setLineTypedValue(null);
          window.dispatchEvent(new CustomEvent("watchlist-stock-line-state", { detail: { symbol, active: false } }));
        }}
        onMouseLeave={() => { if (proCrosshairRef.current) proCrosshairRef.current.style.display = "none"; clearHover(); }}
      >
        {isLoading ? (
          <PriceHistoryLoadingAnimation />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-negative/30 bg-negative/5 px-4 text-center">
            <p className="text-sm font-medium text-text-primary">Chart unavailable</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-text-muted">{error}</p>
            <button type="button" onClick={() => setReloadNonce((n) => n + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-text-primary transition hover:bg-panel-muted">
              <RotateCcw className="h-4 w-4" aria-hidden /> Retry
            </button>
          </div>
        ) : hasData ? (
          <>
          <style>{`
            @keyframes chart-reveal {
              from { clip-path: inset(0 100% 0 0); }
              to   { clip-path: inset(0 0% 0 0); }
            }
          `}</style>
          <div
            key={chartKey}
            style={{ animation: "chart-reveal 0.7s cubic-bezier(0.4,0,0.2,1) both", width: "100%", height: "100%", pointerEvents: squarePlacementActive || diagonalPlacementActive ? "none" : undefined }}
          >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={visibleChartData}
              margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
              onMouseMove={(state) => {
                if (linePlacementActive || squarePlacementActive || diagonalPlacementActive) return;
                if (!window.matchMedia("(min-width: 1024px)").matches) return;
                const x = (state as { activeCoordinate?: { x?: number } }).activeCoordinate?.x;
                const width = chartRef.current?.getBoundingClientRect().width;
                if (x !== undefined && width) positionVolumeCrosshair((x / width) * 100);
              }}
            >
              {/* No Y axis, no grid lines */}
              <CartesianGrid stroke="transparent" />
              <YAxis domain={priceYDomain} allowDataOverflow hide />
              <XAxis dataKey="date" hide />

              <Tooltip
                cursor={(() => {
                  if (linePlacementActive || squarePlacementActive || diagonalPlacementActive) return false;
                  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                  if (isTouchDevice) return false;
                  if (proMode) {
                    // Vertical line only — drawn via SVG props (what Recharts cursor accepts).
                    // The horizontal line is positioned from the committed active-dot ref.
                    return { stroke: "rgba(128,128,128,0.5)", strokeWidth: 1 };
                  }
                  return { stroke: "rgba(128,128,128,0.4)", strokeWidth: 1 };
                })()}
                content={(() => {
                  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                  if (isTouchDevice) return <></>;
                  return <CrosshairTooltip
                    period={period}
                    onHover={onHover}
                    isTouching={isTouching}
                    hideBubble={hideCursorDateTooltip}
                  />;
                })()}
              />

              {useCandlesticks ? (
                /* Keeps the native tooltip and hover logic tied to close. */
                <Area dataKey="close" stroke="transparent" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
              ) : (
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                fill="none"
                strokeWidth={isLongTerm ? 2 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={(props: Record<string, unknown>) => {
                  if (linePlacementActive || squarePlacementActive || diagonalPlacementActive) return <g key="line-placement-no-dot" />;
                  const { cx, cy } = props as { cx?: number; cy?: number };
                  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                  if (isTouchDevice) return <g key="no-dot" />;
                  if (cx == null || cy == null) return <g key="no-dot2" />;
                  return <circle
                    key="dot"
                    ref={(node) => {
                      const guide = proCrosshairRef.current;
                      if (!guide) return;
                      if (proMode && node) {
                        guide.style.display = "block";
                        guide.style.top = `${node.cy.baseVal.value}px`;
                      } else {
                        guide.style.display = "none";
                      }
                    }}
                    className="stock-chart-hover-dot" cx={cx} cy={cy} r={5} fill={lineColor} stroke="#000" strokeWidth={2}
                  />;
                }}
                isAnimationActive={false}
              />
              )}
              {useCandlesticks && <Customized component={CandlestickLayer} />}

              {/* ── Moving average overlays ── */}
              {(MA_AVAILABILITY[period] ?? []).includes(7) && renderedMAs.has(7) && (
                <Line key="ma7" type="monotone" dataKey="ma7" stroke={MA_COLORS[7]} strokeWidth={3}
                  dot={false} activeDot={false} isAnimationActive={pendingMAAnimations.has(7)} animationDuration={700} animationEasing="ease-out" connectNulls
                  onAnimationEnd={() => setPendingMAAnimations((previous) => {
                    const next = new Set(previous); next.delete(7); return next;
                  })} />
              )}
              {(MA_AVAILABILITY[period] ?? []).includes(25) && renderedMAs.has(25) && (
                <Line key="ma25" type="monotone" dataKey="ma25" stroke={MA_COLORS[25]} strokeWidth={3}
                  dot={false} activeDot={false} isAnimationActive={pendingMAAnimations.has(25)} animationDuration={700} animationEasing="ease-out" connectNulls
                  onAnimationEnd={() => setPendingMAAnimations((previous) => {
                    const next = new Set(previous); next.delete(25); return next;
                  })} />
              )}
              {(MA_AVAILABILITY[period] ?? []).includes(99) && renderedMAs.has(99) && (
                <Line key="ma99" type="monotone" dataKey="ma99" stroke={MA_COLORS[99]} strokeWidth={3}
                  dot={false} activeDot={false} isAnimationActive={pendingMAAnimations.has(99)} animationDuration={700} animationEasing="ease-out" connectNulls
                  onAnimationEnd={() => setPendingMAAnimations((previous) => {
                    const next = new Set(previous); next.delete(99); return next;
                  })} />
              )}
              {showPriceAlertLines && priceAlerts
                .filter(alert => alert.price >= priceYDomain[0] && alert.price <= priceYDomain[1])
                .map(alert => (
                  <ReferenceLine key={`price-alert-${alert.id}`} className={animatingAlertIds.has(alert.id) ? "price-alert-line-enter" : undefined} y={alert.price} stroke="#858585" strokeDasharray="6 5" strokeWidth={1.5} ifOverflow="discard" />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
          </div>

          {(manualDiagonals.length > 0 || diagonalPlacementActive) && <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden" aria-hidden="false">
            {manualDiagonals.map((diagonal) => {
              const bounds = chartRef.current?.getBoundingClientRect();
              if (!bounds || visibleRange.end <= visibleRange.start) return null;
              const firstIndex = Math.min(diagonal.x1, diagonal.x2);
              const lastIndex = Math.max(diagonal.x1, diagonal.x2);
              const clippedStart = Math.max(firstIndex, visibleRange.start);
              const clippedEnd = Math.min(lastIndex, visibleRange.end);
              if (clippedEnd < clippedStart) return null;
              const indices = diagonal.x1 <= diagonal.x2 ? [clippedStart, clippedEnd] : [clippedEnd, clippedStart];
              const visibleCount = visibleRange.end - visibleRange.start;
              const pointFor = (index: number, price: number) => ({
                x: ((index - visibleRange.start) / visibleCount) * bounds.width,
                y: 8 + ((priceYDomain[1] - price) / (priceYDomain[1] - priceYDomain[0])) * (bounds.height - 8),
              });
              const priceAt = (index: number) => diagonal.y1 + ((index - diagonal.x1) / (diagonal.x2 - diagonal.x1)) * (diagonal.y2 - diagonal.y1);
              const a = pointFor(indices[0], diagonal.x1 === diagonal.x2 ? diagonal.y1 : priceAt(indices[0]));
              const b = pointFor(indices[1], diagonal.x1 === diagonal.x2 ? diagonal.y2 : priceAt(indices[1]));
              const selected = selectedManualDiagonalId === diagonal.id;
              return <g key={diagonal.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selected ? "#c4c4c4" : "#858585"} strokeWidth={1} strokeDasharray="8 6" pointerEvents="none" />
                <line data-drawing-hit="true" role="button" tabIndex={0} aria-label={selected ? "Selected diagonal line; press Delete to remove" : "Select diagonal line; press Delete to remove"}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} pointerEvents="stroke"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedManualDiagonalId(diagonal.id);
                    setSelectedManualLineId(null);
                    setSelectedManualSquareId(null);
                  }} />
              </g>;
            })}
            <line ref={diagonalPreviewRef} x1="0" y1="0" x2="0" y2="0" stroke="#858585" strokeWidth={1} strokeDasharray="8 6" style={{ display: "none" }} />
          </svg>}

          {/* Manual price lines and the live placement preview are chart overlays. */}
          {[
            ...manualPriceLines.map((line) => ({ id: line.id, price: line.price, preview: false })),
            ...(linePlacementActive && (lineCursorPrice !== null || lineTypedValue !== null) ? [{ id: -1, price: lineTypedValue !== null && Number.isFinite(Number(lineTypedValue)) ? Number(lineTypedValue) : lineCursorPrice ?? currentPrice, preview: true }] : []),
          ].map((line) => {
            const bounds = chartRef.current?.getBoundingClientRect();
            const chartHeight = bounds?.height ?? 260;
            const plotTop = 8;
            if (line.price < priceYDomain[0] || line.price > priceYDomain[1]) return null;
            const rawY = plotTop + ((priceYDomain[1] - line.price) / (priceYDomain[1] - priceYDomain[0])) * (chartHeight - plotTop);
            const top = rawY;
            const isSelected = selectedManualLineId === line.id;
            const shownValue = line.preview && lineTypedValue !== null ? lineTypedValue : formatPrice(line.price);
            return (
              <div key={line.preview ? "preview" : line.id} className="pointer-events-none absolute inset-x-0 z-20 h-px" style={{ top: `${(top / chartHeight) * 100}%` }}>
                <span className="absolute bottom-[calc(100%+4px)] left-0 z-10 whitespace-nowrap text-[10px] leading-3 text-[#a0a0a0]">{shownValue}</span>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`${shownValue}${isSelected ? ", selected; press Delete to remove" : ", click to select for deletion"}`}
                  onClick={(event) => {
                    if (line.preview) return;
                    event.stopPropagation();
                    setSelectedManualLineId(line.id);
                    setSelectedManualSquareId(null);
                    setSelectedManualDiagonalId(null);
                  }}
                  className="pointer-events-auto absolute inset-x-0 top-1/2 h-3 min-w-0 -translate-y-1/2 cursor-crosshair border-0 bg-transparent p-0"
                  style={{
                    backgroundColor: "transparent",
                    backgroundImage: `repeating-linear-gradient(90deg, ${line.preview ? "#858585" : isSelected ? "#c4c4c4" : "#858585"} 0 8px, transparent 8px 14px)`,
                    backgroundSize: "auto 1px",
                    backgroundPosition: "center",
                    backgroundRepeat: "repeat-x",
                  }}
                />
              </div>
            );
          })}

          {manualSquares.map((square) => {
            const bounds = chartRef.current?.getBoundingClientRect();
            if (!bounds || visibleRange.end <= visibleRange.start) return null;
            const indexStart = Math.max(Math.min(square.x1, square.x2), visibleRange.start);
            const indexEnd = Math.min(Math.max(square.x1, square.x2), visibleRange.end);
            if (indexEnd <= indexStart) return null;
            const priceTop = Math.max(square.y1, square.y2);
            const priceBottom = Math.min(square.y1, square.y2);
            if (priceTop < priceYDomain[0] || priceBottom > priceYDomain[1]) return null;
            const clippedTopPrice = Math.min(priceTop, priceYDomain[1]);
            const clippedBottomPrice = Math.max(priceBottom, priceYDomain[0]);
            const plotHeight = Math.max(1, bounds.height - 8);
            const yForPrice = (price: number) => 8 + ((priceYDomain[1] - price) / (priceYDomain[1] - priceYDomain[0])) * plotHeight;
            const top = yForPrice(clippedTopPrice);
            const bottom = yForPrice(clippedBottomPrice);
            if (bottom <= top) return null;
            const visibleCount = visibleRange.end - visibleRange.start;
            const isSelected = selectedManualSquareId === square.id;
            return <button
              key={square.id}
              type="button"
              aria-label={isSelected ? "Selected rectangle; press Delete to remove" : "Select rectangle; press Delete to remove"}
              title={isSelected ? "Press Delete or Backspace to remove" : "Select rectangle"}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedManualLineId(null);
                setSelectedManualSquareId(square.id);
                setSelectedManualDiagonalId(null);
              }}
              className="pointer-events-auto absolute z-10 m-0 cursor-pointer p-0"
              style={{
                left: `${((indexStart - visibleRange.start) / visibleCount) * 100}%`,
                top: `${(top / bounds.height) * 100}%`,
                width: `${((indexEnd - indexStart) / visibleCount) * 100}%`,
                height: `${((bottom - top) / bounds.height) * 100}%`,
                ...getDrawingAreaStyle(square.trend, isSelected ? "#c4c4c4" : "#858585"),
                appearance: "none",
              }}
            />;
          })}
          <div
            ref={squarePreviewRef}
            aria-hidden="true"
            className="pointer-events-none absolute z-10 hidden"
            style={getDrawingAreaStyle("up", "#858585")}
          />

          {/* ── Pro mode desktop horizontal crosshair — follows the active dot ── */}
              {proMode && !isTouching && !linePlacementActive && !squarePlacementActive && !diagonalPlacementActive && (
            <div
              ref={proCrosshairRef}
              className="absolute inset-x-0 pointer-events-none"
              aria-hidden
              style={{ display: "none", height: 1, background: "rgba(128,128,128,0.5)" }}
            />
          )}

          {/* ── Custom touch overlay: dot + crosshair line + date bubble ── */}
          {isTouching && touchOverlay && !linePlacementActive && !squarePlacementActive && !diagonalPlacementActive && (() => {
            const xPct = touchOverlay.xPct * 100;
            // Recharts renders the data area with margin top:8 bottom:0.
            // Convert yPct (0=top of data area) into % of the full container height.
            const chartMarginTopPx = 8;
            const rect = chartRef.current?.getBoundingClientRect();
            const containerH = rect?.height ?? 260;
            const dataAreaH = containerH - chartMarginTopPx;
            const dotTopPx = chartMarginTopPx + touchOverlay.yPct * dataAreaH;
            const dotTopPct = (dotTopPx / containerH) * 100;
            return (
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                {/* Vertical crosshair line */}
                <div
                  data-crosshair-v=""
                  className="absolute top-0 bottom-0 w-px bg-white/20"
                  style={{ left: `${xPct}%` }}
                />
                {/* Horizontal crosshair line — Pro Mode only */}
                {proMode && (
                  <div
                    data-crosshair-h=""
                    className="absolute left-0 right-0 h-px"
                    style={{ top: `${dotTopPct}%`, background: "rgba(255,255,255,0.18)" }}
                  />
                )}
                {/* Dot */}
                <div
                  className="stock-chart-hover-dot absolute w-3 h-3 rounded-full border-2 border-black"
                  style={{
                    left: `${xPct}%`,
                    top: `${dotTopPct}%`,
                    transform: "translate(-50%, -50%)",
                    background: lineColor,
                    filter: isPositive
                      ? "drop-shadow(0 0 7px rgba(0, 200, 5, 0.85))"
                      : "drop-shadow(0 0 7px rgba(255, 48, 3, 0.85))",
                  }}
                />
                {/* Date bubble — flip to left side if too close to right edge */}
                {!hideCursorDateTooltip && hoverDate && (
                  <div
                    className="absolute top-2 rounded-md border border-white/25 px-2.5 py-1.5 text-xs text-text-muted"
                    style={{
                      left: xPct > 65 ? undefined : `calc(${xPct}% + 10px)`,
                      right: xPct > 65 ? `calc(${100 - xPct}% + 10px)` : undefined,
                      background: "linear-gradient(155deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.35))",
                      backdropFilter: "blur(22px) saturate(160%)",
                      WebkitBackdropFilter: "blur(22px) saturate(160%)",
                      boxShadow: "0 10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                  >
                    {tooltipLabel(hoverDate, period)}
                  </div>
                )}
              </div>
            );
          })()}
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border-subtle px-4 text-center text-sm text-text-muted">
            Price history is not available for this symbol and period.
          </div>
        )}
      </div>

      {/* ── Compact volume chart — shares the selected price timeframe ── */}
      {showVolumeChart && hasVolume && (
        <section className="mt-0" aria-label="Trading volume">
          <div className="relative h-20 sm:h-24">
            <VolumeChartCanvas buckets={volumeBuckets} colorBars={colorVolumeBars} />
            <div
              ref={volumeCrosshairRef}
              className="pointer-events-none absolute inset-y-0 hidden w-px"
              aria-hidden
              style={{ background: "rgba(128,128,128,0.4)" }}
            />
          </div>
        </section>
      )}

      {/* ── Period selector — centred below charts ───────────────────── */}
      <div className="mt-4 flex justify-center">
        {/* Phone only: years (1Y/2Y/5Y/ALL) on their own row below the rest */}
        <div className="chart-period-selector-glass chart-period-selector-phone relative flex flex-col items-center gap-1.5 rounded-3xl border p-1.5 lg:hidden">
          <span
            className="chart-period-indicator"
            aria-hidden="true"
            style={{ transform: `translate(${SHORT_PERIODS.includes(period) ? SHORT_PERIODS.indexOf(period) * 40 : LONG_PERIODS.indexOf(period) * 40}px, ${SHORT_PERIODS.includes(period) ? 0 : 42}px)` }}
          />
          <div className="flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap overflow-x-auto">
            {SHORT_PERIODS.map((o, index) => renderPeriodButton({ key: o, option: o, index }))}
          </div>
          <div className="flex flex-nowrap items-center justify-center gap-1 whitespace-nowrap overflow-x-auto">
            {LONG_PERIODS.map((o, index) => renderPeriodButton({ key: o, option: o, index: SHORT_PERIODS.length + index }))}
          </div>
        </div>
        {/* Desktop: unchanged, single row */}
        <div
          className="chart-period-selector-glass chart-period-selector-desktop relative hidden flex-nowrap items-center justify-center gap-1 rounded-full border p-1 lg:flex"
          onMouseLeave={() => setHoveredPeriod(null)}
        >
          <span
            className="chart-period-indicator"
            aria-hidden="true"
            style={{ transform: `translate(${([...SHORT_PERIODS, ...LONG_PERIODS].indexOf(period)) * 40}px, 0)` }}
          />
          {[...SHORT_PERIODS, ...LONG_PERIODS].map((o, index) => renderPeriodButton({ key: o, option: o, index, desktop: true }))}
        </div>
      </div>

      {/* ── Moving average toggles — only shown when at least one MA makes
          sense for the currently selected period ── */}
      {!hideMovingAverageControls && displayedMAWindows.length > 0 && (
        <>
        <style>{`
          @keyframes ma-btn-pop {
            from { transform: scale(0); opacity: 0; }
            to   { transform: scale(1); opacity: 1; }
          }
          @keyframes ma-btn-pop-out {
            from { transform: scale(1); opacity: 1; }
            to   { transform: scale(0); opacity: 0; }
          }
        `}</style>
        <div className="mt-3 flex items-center justify-center gap-2">
          {displayedMAWindows.map((window) => {
            const active   = activeMAs.has(window);
            const exiting  = exitingMAWindows.has(window);
            const color    = MA_COLORS[window];
            return (
              <button
                key={window}
                type="button"
                disabled={exiting}
                onClick={() => {
                  const willEnable = !activeMAs.has(window);
                  setPendingMAAnimations((previous) => {
                    const next = new Set(previous);
                    if (willEnable) next.add(window); else next.delete(window);
                    return next;
                  });
                  setActiveMAs(prev => {
                    const next = new Set(prev);
                    if (next.has(window)) next.delete(window); else next.add(window);
                    return next;
                  });
                }}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border"
                style={{
                  ...(active
                    ? { borderColor: color, backgroundColor: `${color}22`, color }
                    : { borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)" }),
                  animation: exiting
                    ? "ma-btn-pop-out 0.32s cubic-bezier(0.4, 0, 1, 1) both"
                    : "ma-btn-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                MA({window})
              </button>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatPrice(price: number): string {
  // Always 2 decimal places, with $ prefix and thousands comma
  const formatted = price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `$${formatted}`;
}
