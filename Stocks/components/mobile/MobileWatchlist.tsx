"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Star } from "lucide-react";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { formatPercent } from "@/lib/format";
import { DEFAULT_WATCHLIST } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/types/stock";

const STORAGE_KEY = "market-lens-watchlist";

function readWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    return DEFAULT_WATCHLIST;
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function writeWatchlist(symbols: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  window.dispatchEvent(new Event("watchlist-updated"));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

function MiniSparkline({ stock }: { stock: StockSummary }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const currentPrice = stock.price ?? 0;
  const yesterdayClose = currentPrice - (stock.change ?? 0);
  const data = stock.sparkline?.length
    ? [{ close: yesterdayClose, time: 0 }, ...stock.sparkline]
    : [{ time: 0, close: yesterdayClose }, { time: 1, close: currentPrice }];
  return (
    <div className="h-10 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide width={0} />
          <Area type="monotone" dataKey="close"
            stroke={isPos ? "#00c805" : "#ff3003"}
            fill="transparent" strokeWidth={2}
            strokeLinecap="round" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const REVEAL_WIDTH = 76;
const OVERDRAG_MAX = 28;

function withResistance(raw: number) {
  if (raw >= -REVEAL_WIDTH) return raw;
  const excess = -REVEAL_WIDTH - raw;
  const damped = OVERDRAG_MAX * (1 - Math.exp(-excess / OVERDRAG_MAX));
  return -REVEAL_WIDTH - damped;
}

const SETTLE_TRANSITION = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

function WatchlistRow({ stock, onRemove }: { stock: StockSummary; onRemove: (s: string) => void }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const rowRef   = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLAnchorElement>(null);

  // Use refs for drag state to avoid re-renders mid-gesture
  const dragXRef     = useRef(0);
  const draggingRef  = useRef(false);
  const revealedRef  = useRef(false);
  const startRef     = useRef<{ x: number; y: number; startDragX: number; decided: boolean; isH: boolean } | null>(null);

  function applyX(x: number, animate: boolean) {
    const el = innerRef.current;
    if (!el) return;
    el.style.transition = animate ? SETTLE_TRANSITION : "none";
    el.style.transform  = `translateX(${x}px)`;
  }

  function close() {
    dragXRef.current    = 0;
    revealedRef.current = false;
    applyX(0, true);
  }

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, startDragX: dragXRef.current, decided: false, isH: false };
    }

    function onTouchMove(e: TouchEvent) {
      const start = startRef.current;
      if (!start) return;
      const t  = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      if (!start.decided) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;   // wait for intent
        start.decided = true;
        start.isH     = Math.abs(dx) > Math.abs(dy);
        if (!start.isH) { startRef.current = null; return; }
        draggingRef.current = true;
      }

      if (!start.isH) return;
      e.preventDefault();                                      // blocks scroll
      e.stopPropagation();

      const raw  = start.startDragX + dx;
      const next = raw > 0 ? 0 : withResistance(raw);
      dragXRef.current = next;
      applyX(next, false);
    }

    function onTouchEnd() {
      if (!startRef.current?.isH) { startRef.current = null; draggingRef.current = false; return; }
      const shouldReveal = dragXRef.current < -REVEAL_WIDTH / 2;
      const target       = shouldReveal ? -REVEAL_WIDTH : 0;
      dragXRef.current   = target;
      revealedRef.current = shouldReveal;
      applyX(target, true);
      draggingRef.current = false;
      startRef.current    = null;
    }

    el.addEventListener("touchstart",  onTouchStart, { passive: true });
    el.addEventListener("touchmove",   onTouchMove,  { passive: false });
    el.addEventListener("touchend",    onTouchEnd,   { passive: true });
    el.addEventListener("touchcancel", onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onScroll() { if (revealedRef.current) close(); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rowRef} className="relative overflow-hidden border-b border-border-subtle/70 last:border-0">
      {/* Swipe-revealed remove button */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center" style={{ width: REVEAL_WIDTH }}>
        <button
          onClick={() => onRemove(stock.symbol)}
          aria-label={`Remove ${stock.symbol}`}
          className="flex items-center justify-center text-positive active:scale-90 transition-transform"
        >
          <Star className="h-5 w-5 fill-current" />
        </button>
      </div>

      <Link
        ref={innerRef}
        href={`/stock/${stock.symbol}`}
        onClick={(e) => { if (revealedRef.current) { e.preventDefault(); close(); } }}
        className="flex items-center gap-3 px-4 py-3.5 bg-black active:bg-panel-muted"
        style={{ transform: "translateX(0px)", willChange: "transform" }}
        suppressHydrationWarning
      >
        {stock.logo
          ? <img src={stock.logo} alt="" className="h-9 w-9 rounded-md border border-white/10 bg-white/5 object-contain shrink-0" />
          : <span className="h-9 w-9 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary shrink-0">
              {stock.symbol.replace("^", "").slice(0, 2)}
            </span>
        }
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-text-primary truncate">{stock.symbol}</span>
        </span>
        <MiniSparkline stock={stock} />
        <span className="ml-3 shrink-0">
          <span className={cn(
            "inline-block text-sm font-bold text-black px-3 py-1 rounded-lg",
            isPos ? "bg-positive" : "bg-negative"
          )}>
            {formatPercent(stock.changePercent)}
          </span>
        </span>
      </Link>
    </div>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks]   = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const fetchedRef            = useRef<Set<string>>(new Set());

  useEffect(() => {
    function sync() { setSymbols(readWatchlist()); }
    sync();
    window.addEventListener("watchlist-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("watchlist-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const missing = symbols.filter(s => !fetchedRef.current.has(s));
    if (!missing.length) { setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/market?watchlist=${missing.join(",")}`, { signal: ctrl.signal })
      .then(r => r.json() as Promise<{ tickerStocks?: StockSummary[] }>)
      .then(d => {
        const fetched = d.tickerStocks ?? [];
        fetched.forEach(s => fetchedRef.current.add(s.symbol));
        setStocks(prev => {
          const next = new Map(prev);
          fetched.forEach(s => next.set(s.symbol, s));
          return next;
        });
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [symbols]);

  function handleRemove(symbol: string) {
    const updated = symbols.filter(s => s !== symbol);
    setSymbols(updated);
    writeWatchlist(updated);
  }

  const orderedStocks = symbols.map(s => stocks.get(s)).filter(Boolean) as StockSummary[];

  if (loading && !orderedStocks.length) return <LoadingScreen label="Loading your watchlist" />;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 px-4 pt-6 pb-4 bg-background/85 backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-positive">Watchlist</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Your Stocks</h1>
      </div>

      {orderedStocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-lg font-semibold text-text-primary">Your watchlist is empty</p>
          <p className="text-sm text-text-muted">Search for stocks to add them.</p>
        </div>
      ) : (
        <div className="mx-4 mt-6 rounded-xl bg-black overflow-hidden">
          {orderedStocks.map(stock => (
            <WatchlistRow key={stock.symbol} stock={stock} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
