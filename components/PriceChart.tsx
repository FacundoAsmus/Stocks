"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CandlePoint, ChartPeriod } from "@/types/stock";

const SHORT_PERIODS: ChartPeriod[] = ["1D", "1W", "1M", "2M", "3M", "5M", "6M"];
const LONG_PERIODS:  ChartPeriod[] = ["1Y", "2Y", "5Y", "ALL"];
const LONG_TERM_SET  = new Set<ChartPeriod>(["1Y", "2Y", "5Y", "ALL"]);
const INTRADAY_SET   = new Set<ChartPeriod>(["1D", "1W"]);

/* ─── Date label for tooltip crosshair ──────────────────────────────────── */
function tooltipLabel(dateStr: string, period: ChartPeriod): string {
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

function tickGap(period: ChartPeriod): number {
  if (period === "1D") return 60;
  if (period === "1W") return 55;
  if (period === "5Y" || period === "ALL") return 44;
  if (period === "1Y" || period === "2Y") return 36;
  return 28;
}

/* ─── Number-wheel digit ─────────────────────────────────────────────────── */
// Each digit is a vertical strip of 0–9. We translate it up by idx × rowPx.
// Digit wheel — vertical strip of 0–9, clipped to one row height.
// Width per digit is set via CSS `ch` units scoped to each size, which gives
// natural variable spacing (1 narrower than 8) without any JS measurement loop.
const DIGIT_CHARS = ["0","1","2","3","4","5","6","7","8","9"];

// Proportional widths as a fraction of rowPx (measured from Inter at text-5xl/text-2xl).
// "1" is naturally narrow; "0","4","8" are wide. These ratios stay correct at any px size.
const DIGIT_RATIO: Record<string, number> = {
  "0": 0.62, "1": 0.36, "2": 0.58, "3": 0.58,
  "4": 0.62, "5": 0.58, "6": 0.60, "7": 0.52,
  "8": 0.62, "9": 0.60,
};

function Digit({ ch, size = "lg" }: { ch: string; size?: "sm" | "lg" }) {
  const isDigit = DIGIT_CHARS.includes(ch);
  const idx     = isDigit ? parseInt(ch) : 0;

  const rowPx     = size === "lg" ? 54 : 32;
  const fontClass = size === "lg"
    ? "text-5xl font-semibold text-text-primary"
    : "text-2xl font-medium";

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

  const slotPx = Math.round((DIGIT_RATIO[ch] ?? 0.62) * rowPx);

  return (
    <span
      className="inline-block overflow-hidden align-bottom"
      style={{ height: rowPx, width: slotPx, transition: "width 1.04s cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${idx * rowPx}px)`,
          transition: "transform 1.04s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {DIGIT_CHARS.map((d) => (
          <span
            key={d}
            className={cn(fontClass, "block text-center select-none leading-none")}
            style={{ height: rowPx, lineHeight: `${rowPx}px`, width: slotPx }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ─── Animated price display (wheels for digits, static for $ . , + - %) ── */
function WheelPrice({
  value,
  size = "lg",
  colorClass,
}: {
  value: string;
  size?: "sm" | "lg";
  colorClass?: string;
}) {
  const chars = value.split("");
  return (
    <span className={cn("inline-flex items-end", colorClass)}>
      {chars.map((ch, i) => (
        <Digit key={i} ch={ch} size={size} />
      ))}
    </span>
  );
}

/* ─── Custom crosshair tooltip ───────────────────────────────────────────── */
function CrosshairTooltip({
  active,
  payload,
  label,
  period,
  onHover
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  period: ChartPeriod;
  onHover: (price: number | null, date: string | null) => void;
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

  if (!active || price === null || !date) return null;

  return (
    <div className="rounded-md border border-positive/60 bg-black/90 px-2.5 py-1.5 text-xs text-text-muted shadow-lg shadow-positive/10 backdrop-blur-sm pointer-events-none">
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
  priceIndent
}: {
  symbol: string;
  currentPrice: number;
  currentChangePercent: number;
  previousClose?: number;
  initialPeriod?: ChartPeriod;
  heightClassName?: string;
  priceIndent?: string;
}) {
  const [period, setPeriod]           = useState<ChartPeriod>(initialPeriod);
  const [data, setData]               = useState<CandlePoint[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [hoverPrice, setHoverPrice]   = useState<number | null>(null);
  const [hoverDate,  setHoverDate]    = useState<string | null>(null);
  const [priceVisible, setPriceVisible] = useState(true);

  /* Load candles */
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setIsLoading(true);
      setError(null);
      setHoverPrice(null);
      setHoverDate(null);
      setPriceVisible(false);
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}`,
          { signal: controller.signal }
        );
        const payload = (await res.json()) as { candles?: CandlePoint[]; error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Unable to load chart data.");
        const candles = payload.candles ?? [];
        if (candles.length && !LONG_TERM_SET.has(period)) {
          const todayPrefix = new Date().toISOString().slice(0, 10);
          const last  = candles[candles.length - 1];
          if (!last.date.startsWith(todayPrefix)) {
            const liveRes   = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbol)}`, { signal: controller.signal });
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
  }, [period, reloadNonce, symbol]);

  const hasData    = data.length > 1;
  const isLongTerm = LONG_TERM_SET.has(period);

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

  const onHover = useCallback((price: number | null, date: string | null) => {
    setHoverPrice(price);
    setHoverDate(date);
  }, []);

  function PeriodButton({ option }: { option: ChartPeriod }) {
    const active = period === option;
    return (
      <button
        type="button"
        onClick={() => { setPeriod(option); }}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm",
          active ? "bg-positive/15 text-positive" : "text-text-muted hover:text-text-primary"
        )}
      >
        {option}
      </button>
    );
  }

  return (
    <div>
      {/* ── Price header — indented to align with name when priceIndent is set ── */}
      <div className="mb-6" style={{ ...(priceIndent ? { paddingLeft: priceIndent } : {}), opacity: priceVisible ? 1 : 0, transition: "opacity 0.18s ease" }}>
        <div className="flex items-end gap-3">
          <WheelPrice value={priceStr} size="lg" />
          <WheelPrice value={pctStr} size="sm" colorClass={pctColor} />
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {hoverDate ? tooltipLabel(hoverDate, period) : "Current price"}
        </p>
      </div>

      {/* ── Chart area ────────────────────────────────────────────────── */}
      <div className={heightClassName}>
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 rounded-md border border-dashed border-border-subtle">
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
              <div className="flex flex-col items-center gap-[2px]">
                <div className="cw-1 w-[2px] h-1.5 rounded-full bg-positive/50" />
                <div className="cc-1 w-3.5 h-4 rounded-sm bg-positive/50" />
              </div>
              <div className="flex flex-col items-center gap-[2px]">
                <div className="cw-2 w-[2px] h-2 rounded-full bg-positive/70" />
                <div className="cc-2 w-3.5 h-6 rounded-sm bg-positive/70" />
              </div>
              <div className="flex flex-col items-center gap-[2px]">
                <div className="cw-3 w-[2px] h-2.5 rounded-full bg-positive" />
                <div className="cc-3 w-3.5 h-8 rounded-sm bg-positive" />
              </div>
            </div>
            <span className="text-sm text-text-muted">Loading price history</span>
          </div>
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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
              onMouseLeave={() => onHover(null, null)}
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={lineColor} stopOpacity={isLongTerm ? 0.18 : 0.06} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* No Y axis, no grid lines */}
              <CartesianGrid stroke="transparent" />
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <XAxis dataKey="date" hide />

              <Tooltip
                cursor={{ stroke: "#ffffff22", strokeWidth: 1 }}
                content={
                  <CrosshairTooltip period={period} onHover={onHover} />
                }
              />

              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                fill="url(#chartFill)"
                strokeWidth={isLongTerm ? 2 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border-subtle px-4 text-center text-sm text-text-muted">
            Price history is not available for this symbol and period.
          </div>
        )}
      </div>

      {/* ── Period selector — centred below chart ────────────────────── */}
      <div className="mt-4 flex justify-center">
        <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-background p-1">
          <div className="flex items-center justify-center">
            {SHORT_PERIODS.map((o) => <PeriodButton key={o} option={o} />)}
          </div>
          <div className="mx-1 h-px bg-border-subtle" />
          <div className="flex items-center justify-center">
            {LONG_PERIODS.map((o) => <PeriodButton key={o} option={o} />)}
          </div>
        </div>
      </div>
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
