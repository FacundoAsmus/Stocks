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
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area type="monotone" dataKey="close"
            stroke={isPos ? "#00c805" : "#ff3003"}
            fill="transparent" strokeWidth={2}
            strokeLinecap="round" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const REVEAL_WIDTH = 76; // px width of the swipe-revealed star/remove action

function WatchlistRow({ stock, onRemove }: { stock: StockSummary; onRemove: (s: string) => void }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const [dragX, setDragX] = useState(0); // 0..-REVEAL_WIDTH
  const [dragging, setDragging] = useState(false);
  const revealedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; startDragX: number; horizontal: boolean } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, startDragX: dragX, horizontal: false };
  }

  function onTouchMove(e: React.TouchEvent) {
    const start = startRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (!start.horizontal) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) >= Math.abs(dx)) { startRef.current = null; return; } // vertical scroll — let it pass
      start.horizontal = true;
      setDragging(true);
    }

    e.preventDefault();
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, start.startDragX + dx));
    setDragX(next);
  }

  function onTouchEnd() {
    if (startRef.current?.horizontal) {
      const shouldReveal = dragX < -REVEAL_WIDTH / 2;
      setDragX(shouldReveal ? -REVEAL_WIDTH : 0);
      revealedRef.current = shouldReveal;
    }
    setDragging(false);
    startRef.current = null;
  }

  function closeSwipe() {
    setDragX(0);
    revealedRef.current = false;
  }

  return (
    <div className="relative overflow-hidden border-b border-border-subtle/70 last:border-0">
      {/* Swipe-revealed remove action */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{ width: REVEAL_WIDTH }}
      >
        <button
          onClick={() => onRemove(stock.symbol)}
          aria-label={`Remove ${stock.symbol}`}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-positive text-black active:scale-90 transition-transform"
        >
          <Star className="h-5 w-5 fill-current" />
        </button>
      </div>

      <Link
        href={`/stock/${stock.symbol}`}
        onClick={(e) => { if (revealedRef.current) { e.preventDefault(); closeSwipe(); } }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex items-center gap-3 px-4 py-3.5 bg-black active:bg-panel-muted"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
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
