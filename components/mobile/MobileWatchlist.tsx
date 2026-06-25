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
  // Dispatch both events so AddToWatchlistButton star states stay in sync
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

function WatchlistRow({ stock, onRemove }: { stock: StockSummary; onRemove: (s: string) => void }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle/40 last:border-0">
      <Link href={`/stock/${stock.symbol}`} className="flex items-center gap-3 flex-1 min-w-0">
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
      <button
        onClick={() => onRemove(stock.symbol)}
        className="ml-2 shrink-0 text-positive active:text-negative transition-colors p-1"
        aria-label={`Remove ${stock.symbol}`}
      >
        <Star className="h-4 w-4 fill-current" />
      </button>
    </div>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks] = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  // Track which symbols we have already fetched data for
  const fetchedRef = useRef<Set<string>>(new Set());

  // Sync symbols from localStorage — on mount and whenever watchlist changes
  useEffect(() => {
    function sync() {
      setSymbols(readWatchlist());
    }
    sync();
    window.addEventListener("watchlist-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("watchlist-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Fetch data only for symbols we don't have yet
  useEffect(() => {
    const missing = symbols.filter(s => !fetchedRef.current.has(s));
    if (!missing.length) {
      setLoading(false);
      return;
    }
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
    writeWatchlist(updated);
    // State will update via the watchlist-updated listener above
  }

  // Derive ordered list from symbols (preserves order, skips missing data gracefully)
  const orderedStocks = symbols.map(s => stocks.get(s)).filter(Boolean) as StockSummary[];

  return (
    <div className="pb-24">
      <div className="px-4 pt-6 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-positive">Watchlist</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Your Stocks</h1>
      </div>

      {loading && !orderedStocks.length ? (
        <LoadingScreen label="Loading your watchlist" />
      ) : !symbols.length ? (
        <div className="mx-4 rounded-xl border border-dashed border-border-subtle p-8 text-center">
          <Star className="h-8 w-8 mx-auto mb-3 text-text-muted/40" />
          <p className="text-sm font-semibold text-text-primary mb-1">No stocks yet</p>
          <p className="text-xs text-text-muted">Search for a stock and tap the star to add it.</p>
        </div>
      ) : (
        <div className="mx-4 rounded-xl border border-border-subtle bg-panel overflow-hidden">
          {orderedStocks.map(s => (
            <WatchlistRow key={s.symbol} stock={s} onRemove={handleRemove} />
          ))}
          {/* Placeholder rows for symbols still loading */}
          {symbols.filter(s => !stocks.has(s)).map(sym => (
            <div key={sym} className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle/40 last:border-0 opacity-40">
              <span className="h-9 w-9 rounded-md bg-panel-muted shrink-0 animate-pulse" />
              <span className="flex-1">
                <span className="block text-sm font-bold text-text-primary">{sym}</span>
                <span className="block h-3 w-20 bg-panel-muted rounded mt-1 animate-pulse" />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
