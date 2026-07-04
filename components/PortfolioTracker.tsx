"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, YAxis,
} from "recharts";
import { BarChart2, ChevronDown } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/format";
import {
  TrackerHolding,
  AggregatedPosition,
  addHolding,
  aggregateByTicker,
  calcPortfolioValue,
  calcTodayChange,
  calcTotalCost,
  readTracker,
  removeHolding,
} from "@/lib/tracker";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/types/stock";

// suppress unused import warnings from tree-shaking
void addHolding; void calcTotalCost;

type Period = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";
const PERIODS: Period[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];

// ── Tooltip label helper ────────────────────────────────────────────────────
function tooltipDateLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr);
  if (period === "1D")
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (period === "1W")
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (period === "1Y")
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Portfolio chart ─────────────────────────────────────────────────────────
interface PortfolioPoint { time: number; value: number; date: string }

function PortfolioChart({
  holdings,
  onPeriodChange,
  onHoverValue,
}: {
  holdings: TrackerHolding[];
  onPeriodChange: (period: Period, firstValue: number, lastValue: number) => void;
  onHoverValue: (v: number | null) => void;
}) {
  const [period, setPeriod] = useState<Period>("1M");
  const [data, setData] = useState<PortfolioPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Touch overlay state — mirrors PriceChart exactly
  const [isTouching, setIsTouching] = useState(false);
  const [touchOverlay, setTouchOverlay] = useState<{ xPct: number; yPct: number } | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const suppressRef = useRef(false);
  const dataRef = useRef<PortfolioPoint[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const blockScrollRef = useRef<((e: TouchEvent) => void) | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  const lineColor = useMemo(() => {
    if (data.length < 2) return "#00c805";
    return data[data.length - 1].value >= data[0].value ? "#00c805" : "#ff3003";
  }, [data]);

  // Fetch portfolio history
  useEffect(() => {
    if (!holdings.length) { setData([]); return; }
    setIsLoading(true);
    const ctrl = new AbortController();

    async function load() {
      try {
        const byTicker: Record<string, number> = {};
        for (const h of holdings) {
          byTicker[h.ticker] = (byTicker[h.ticker] ?? 0) + h.quantity;
        }

        const results = await Promise.all(
          Object.entries(byTicker).map(([ticker, qty]) =>
            fetch(`/api/candles?symbol=${encodeURIComponent(ticker)}&period=${period}`, { signal: ctrl.signal })
              .then(r => r.json() as Promise<{ candles?: { time: number; close: number; date: string }[] }>)
              .then(d => ({ qty, candles: d.candles ?? [] }))
              .catch(() => ({ qty, candles: [] as { time: number; close: number; date: string }[] }))
          )
        );

        const timeMap = new Map<number, { value: number; date: string }>();
        for (const { qty, candles } of results) {
          for (const { time, close, date } of candles) {
            const existing = timeMap.get(time);
            timeMap.set(time, {
              value: (existing?.value ?? 0) + qty * close,
              date: existing?.date ?? date,
            });
          }
        }

        const allTimeSets = results.map(r => new Set(r.candles.map(c => c.time)));
        const commonTimes = [...timeMap.keys()].filter(t =>
          allTimeSets.every(set => set.has(t))
        );

        const sorted = commonTimes
          .sort((a, b) => a - b)
          .map(t => {
            const e = timeMap.get(t)!;
            return { time: t, value: e.value, date: e.date };
          });

        setData(sorted);
        const first = sorted[0]?.value ?? 0;
        const last  = sorted[sorted.length - 1]?.value ?? 0;
        onPeriodChange(period, first, last);
        onHoverValue(null);
      } catch { /* abort */ }
      finally { if (!ctrl.signal.aborted) setIsLoading(false); }
    }

    load();
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, period]);

  // Notify parent when period changes (reset hover)
  function handlePeriod(p: Period) {
    setPeriod(p);
    onHoverValue(null);
    setHoverDate(null);
    setIsTouching(false);
    setTouchOverlay(null);
  }

  // Touch tracking — identical logic to PriceChart
  const clearHover = useCallback(() => {
    suppressRef.current = true;
    setIsTouching(false);
    setTouchOverlay(null);
    setHoverDate(null);
    onHoverValue(null);
    requestAnimationFrame(() => requestAnimationFrame(() => { suppressRef.current = false; }));
  }, [onHoverValue]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const updateFromClientX = (clientX: number) => {
      const pts = dataRef.current;
      if (!pts.length) return;
      const rect = el.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
      const xPct = (clampedX - rect.left) / rect.width;
      const idx  = Math.round(xPct * (pts.length - 1));
      const pt   = pts[Math.max(0, Math.min(pts.length - 1, idx))];

      const values = pts.map(p => p.value);
      const minV = Math.min(...values);
      const maxV = Math.max(...values);
      const yPct = maxV === minV ? 0.5 : 1 - (pt.value - minV) / (maxV - minV);

      suppressRef.current = true;
      onHoverValue(pt.value);
      setHoverDate(pt.date);
      setTouchOverlay({ xPct, yPct });
      requestAnimationFrame(() => { suppressRef.current = false; });
    };

    const onTouchMove = (e: TouchEvent) => updateFromClientX(e.touches[0].clientX);

    const onTouchEnd = () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      if (blockScrollRef.current) {
        document.removeEventListener("touchmove", blockScrollRef.current);
        blockScrollRef.current = null;
      }
      clearHover();
    };

    const onTouchStart = (e: TouchEvent) => {
      setIsTouching(true);
      updateFromClientX(e.touches[0].clientX);
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onTouchEnd);
      document.addEventListener("touchcancel", onTouchEnd);
      const block = (ev: TouchEvent) => ev.preventDefault();
      blockScrollRef.current = block;
      document.addEventListener("touchmove", block, { passive: false });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      if (blockScrollRef.current) {
        document.removeEventListener("touchmove", blockScrollRef.current);
        blockScrollRef.current = null;
      }
    };
  }, [clearHover]);

  return (
    <div>
      {/* Period selector */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {PERIODS.map(p => (
          <button key={p} onClick={() => handlePeriod(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
              period === p
                ? "bg-positive text-black"
                : "text-text-muted border border-border-subtle/60 hover:border-positive/50 hover:text-positive"
            )}>
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-[260px] flex items-center justify-center">
          <span className="text-xs text-text-muted animate-pulse">Calculating portfolio history…</span>
        </div>
      ) : data.length < 2 ? (
        <div className="h-[260px] flex items-center justify-center text-xs text-text-muted">
          Not enough history for this period
        </div>
      ) : (
        <div ref={chartRef} className="h-[260px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
              onMouseLeave={() => { onHoverValue(null); setHoverDate(null); }}
              onMouseMove={(state) => {
                const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                if (isTouchDevice || suppressRef.current) return;
                const v = state?.activePayload?.[0]?.payload?.value as number | undefined;
                const d = state?.activePayload?.[0]?.payload?.date as string | undefined;
                if (v !== undefined) { onHoverValue(v); setHoverDate(d ?? null); }
                else { onHoverValue(null); setHoverDate(null); }
              }}
            >
              <defs>
                <linearGradient id="pgradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Tooltip
                cursor={(() => {
                  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                  if (isTouchDevice) return false;
                  return { stroke: "#ffffff22", strokeWidth: 1 };
                })()}
                content={(() => {
                  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                  if (isTouchDevice) return <></>;
                  // Desktop tooltip — no-op visually, we use the header to show value
                  return <></>;
                })()}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2.5}
                fill="url(#pgradient)"
                strokeLinecap="round"
                dot={false}
                activeDot={(props: Record<string, unknown>) => {
                  const { cx, cy } = props as { cx?: number; cy?: number };
                  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
                  if (isTouchDevice) return <g key="no-dot" />;
                  if (cx == null || cy == null) return <g key="no-dot2" />;
                  return <circle key="dot" cx={cx} cy={cy} r={5} fill={lineColor} stroke="#000" strokeWidth={2} />;
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Touch overlay */}
          {isTouching && touchOverlay && (() => {
            const xPct = touchOverlay.xPct * 100;
            const chartMarginTopPx = 8;
            const containerH = chartRef.current?.getBoundingClientRect().height ?? 260;
            const dotTopPx = chartMarginTopPx + touchOverlay.yPct * (containerH - chartMarginTopPx);
            const dotTopPct = (dotTopPx / containerH) * 100;
            return (
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                <div className="absolute top-0 bottom-0 w-px bg-white/20"
                  style={{ left: `${xPct}%` }} />
                <div className="absolute w-3 h-3 rounded-full border-2 border-black"
                  style={{
                    left: `${xPct}%`, top: `${dotTopPct}%`,
                    transform: "translate(-50%, -50%)", background: lineColor,
                  }} />
                {hoverDate && (
                  <div
                    className="absolute top-2 rounded-md border border-positive/60 bg-black/90 px-2.5 py-1.5 text-xs text-text-muted shadow-lg backdrop-blur-sm"
                    style={{
                      left: xPct > 65 ? undefined : `calc(${xPct}% + 10px)`,
                      right: xPct > 65 ? `calc(${100 - xPct}% + 10px)` : undefined,
                    }}
                  >
                    {tooltipDateLabel(hoverDate, period)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Moments (collapsible purchase history) ─────────────────────────────────
function Moments({ lots }: { lots: TrackerHolding[] }) {
  const [open, setOpen] = useState(false);
  const sorted = [...lots].sort(
    (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
  );
  return (
    <div className="border-t border-border-subtle/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full px-5 py-2.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        Moments · {lots.length} purchase{lots.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="px-5 pb-3 flex flex-col gap-2">
          {sorted.map((lot, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-text-muted">
                {new Date(lot.purchaseDate).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
              <span className="text-text-primary font-medium">
                {lot.quantity} share{lot.quantity !== 1 ? "s" : ""} @ {formatCurrency(lot.purchasePrice)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Aggregated holding row (one per ticker) ────────────────────────────────
function PositionRow({
  position,
  stock,
  onRemoveTicker,
}: {
  position: AggregatedPosition;
  stock?: StockSummary;
  onRemoveTicker: (ticker: string) => void;
}) {
  const currentPrice  = stock?.price ?? position.avgPurchasePrice;
  const positionValue = position.totalQuantity * currentPrice;
  const pnlDollar     = (currentPrice - position.avgPurchasePrice) * position.totalQuantity;
  const pnlPct        = position.avgPurchasePrice > 0
    ? ((currentPrice - position.avgPurchasePrice) / position.avgPurchasePrice) * 100
    : 0;
  const dailyPct      = stock?.changePercent ?? 0;
  const isPos         = pnlDollar >= 0;

  return (
    <div className="border-b border-border-subtle/40 last:border-0 group">
      <div className="flex items-center gap-3 px-5 py-4">
        <Link href={`/stock/${position.ticker}`} className="flex items-center gap-3 flex-1 min-w-0">
          {stock?.logo
            ? <img src={stock.logo} alt="" className="h-9 w-9 rounded-md border border-white/10 bg-white/5 object-contain shrink-0" />
            : <span className="h-9 w-9 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary shrink-0">
                {position.ticker.replace("^", "").slice(0, 2)}
              </span>
          }
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-text-primary">{position.ticker}</span>
            <span className="block text-xs text-text-muted truncate">{position.companyName}</span>
          </span>

          {/* Price + daily */}
          <span className="text-right shrink-0 mr-4">
            <span className="block text-sm font-semibold text-text-primary">{formatCurrency(currentPrice)}</span>
            <span className={cn("block text-xs font-medium", dailyPct >= 0 ? "text-positive" : "text-negative")}>
              {formatPercent(dailyPct)}
            </span>
          </span>

          {/* Position + P&L */}
          <span className="text-right shrink-0">
            <span className="block text-sm font-semibold text-text-primary">{formatCurrency(positionValue)}</span>
            <span className={cn("block text-xs font-medium", isPos ? "text-positive" : "text-negative")}>
              {isPos ? "+" : ""}{formatCurrency(pnlDollar)} ({isPos ? "+" : ""}{pnlPct.toFixed(2)}%)
            </span>
          </span>
        </Link>
        <button
          onClick={() => onRemoveTicker(position.ticker)}
          className="ml-2 shrink-0 text-text-muted/30 hover:text-negative transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none"
          title="Remove all lots for this stock"
        >×</button>
      </div>
      <Moments lots={position.lots} />
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyTracker() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <BarChart2 className="h-12 w-12 text-text-muted/30" />
      <div>
        <p className="text-lg font-semibold text-text-primary">Your portfolio is empty</p>
        <p className="text-sm text-text-muted mt-1">Add stocks to start tracking your investments.</p>
      </div>
      <Link href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-positive px-5 py-2 text-sm font-semibold text-black hover:bg-positive/90 transition">
        Browse Stocks
      </Link>
    </div>
  );
}

// ── Main PortfolioTracker ──────────────────────────────────────────────────
export function PortfolioTracker() {
  const [holdings, setHoldings]           = useState<TrackerHolding[]>([]);
  const [stocks, setStocks]               = useState<Map<string, StockSummary>>(new Map());
  const [loadingStocks, setLoadingStocks] = useState(false);

  // Graph-driven state — percentage shown in summary card mirrors selected period
  const [periodBounds, setPeriodBounds]   = useState<{ first: number; last: number }>({ first: 0, last: 0 });
  const [hoverValue, setHoverValue]       = useState<number | null>(null);

  void loadingStocks;

  // Load holdings from localStorage
  useEffect(() => {
    function sync() { setHoldings(readTracker()); }
    sync();
    window.addEventListener("tracker-updated", sync);
    return () => window.removeEventListener("tracker-updated", sync);
  }, []);

  // Fetch stock data for all unique tickers
  const uniqueTickers = useMemo(
    () => [...new Set(holdings.map(h => h.ticker))],
    [holdings]
  );

  useEffect(() => {
    if (!uniqueTickers.length) { setStocks(new Map()); return; }
    setLoadingStocks(true);
    const ctrl = new AbortController();
    fetch(`/api/stocks?symbols=${uniqueTickers.join(",")}`, { signal: ctrl.signal })
      .then(r => r.json() as Promise<{ stocks?: StockSummary[] }>)
      .then(d => {
        const map = new Map((d.stocks ?? []).map(s => [s.symbol, s]));
        setStocks(map);
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoadingStocks(false); });
    return () => ctrl.abort();
  }, [uniqueTickers]);

  const prices  = useMemo(
    () => new Map([...stocks.entries()].map(([k, v]) => [k, v.price ?? 0])),
    [stocks]
  );
  const changes = useMemo(
    () => new Map([...stocks.entries()].map(([k, v]) => [k, v.changePercent ?? 0])),
    [stocks]
  );

  const portfolioValue = useMemo(() => calcPortfolioValue(holdings, prices), [holdings, prices]);
  const todayPct       = useMemo(() => calcTodayChange(holdings, prices, changes), [holdings, prices, changes]);

  // Aggregated positions — one per ticker
  const positions = useMemo(() => aggregateByTicker(holdings), [holdings]);

  // Period percentage: mirrors stock page behaviour — based on graph first/last (or hover)
  const displayValue  = hoverValue ?? periodBounds.last;
  const periodPct     = periodBounds.first > 0
    ? ((displayValue - periodBounds.first) / periodBounds.first) * 100
    : 0;
  const periodPos     = periodPct >= 0;

  const handlePeriodChange = useCallback((
    _period: Period, first: number, last: number
  ) => {
    setPeriodBounds({ first, last });
    setHoverValue(null);
  }, []);

  const handleHoverValue = useCallback((v: number | null) => {
    setHoverValue(v);
  }, []);

  function handleRemoveTicker(ticker: string) {
    const updated = readTracker().filter(h => h.ticker !== ticker);
    // write directly
    window.localStorage.setItem("market-lens-tracker", JSON.stringify(updated));
    window.dispatchEvent(new Event("tracker-updated"));
    setHoldings(updated);
  }

  if (!holdings.length) return <EmptyTracker />;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Summary card ──────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-black p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-3">
          Portfolio Value
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <span className="text-5xl font-semibold text-text-primary tracking-tight">
            {formatCurrency(portfolioValue)}
          </span>
          <span className={cn("text-xl font-semibold mb-1", todayPct >= 0 ? "text-positive" : "text-negative")}>
            {todayPct >= 0 ? "+" : ""}{todayPct.toFixed(2)}% today
          </span>
        </div>
        {/* Period % — reacts to graph timeframe and hover, like stock page */}
        <div className="mt-2">
          <span className={cn("text-sm font-medium", periodPos ? "text-positive" : "text-negative")}>
            {periodPos ? "+" : ""}{periodPct.toFixed(2)}% this period
          </span>
        </div>
      </div>

      {/* ── Portfolio graph ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-black p-5">
        <PortfolioChart
          holdings={holdings}
          onPeriodChange={handlePeriodChange}
          onHoverValue={handleHoverValue}
        />
      </div>

      {/* ── Holdings ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border-subtle bg-panel overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle/60 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-positive">Holdings</p>
          <div className="grid grid-cols-3 gap-4 text-xs text-text-muted text-right">
            <span>Price / Day</span>
            <span>Position</span>
            <span>P&amp;L</span>
          </div>
        </div>
        {positions.map(pos => (
          <PositionRow
            key={pos.ticker}
            position={pos}
            stock={stocks.get(pos.ticker)}
            onRemoveTicker={handleRemoveTicker}
          />
        ))}
      </div>
    </div>
  );
}
