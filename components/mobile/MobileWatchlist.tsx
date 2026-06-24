"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Star } from "lucide-react";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/types/stock";

const STORAGE_KEY = "market-lens-watchlist";

function readWatchlist() {
  if (typeof window === "undefined") return [];
  try { const s = window.localStorage.getItem(STORAGE_KEY); return s ? (JSON.parse(s) as string[]) : []; } catch { return []; }
}

function removeFromWatchlist(symbol: string) {
  const current = readWatchlist();
  const updated = current.filter(s => s !== symbol);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  // Note: do NOT dispatch storage event here — we update state directly in handleRemove
  // to avoid triggering the listener which would cause a race condition re-fetch
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
          <Area type="monotone" dataKey="close" stroke={isPos ? "#00c805" : "#ff3003"}
            fill="transparent" strokeWidth={2} strokeLinecap="round" dot={false} isAnimationActive={false} />
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
          : <span className="h-9 w-9 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary shrink-0">{stock.symbol.slice(0, 2)}</span>
        }
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-text-primary truncate">{stock.symbol}</span>
          <span className="block text-xs text-text-muted truncate">{stock.name}</span>
        </span>
        <MiniSparkline stock={stock} />
        <span className="ml-3 text-right shrink-0">
          <span className="block text-sm font-bold text-text-primary">{formatCurrency(stock.price)}</span>
          <span className={cn("block text-xs font-semibold", isPos ? "text-positive" : "text-negative")}>{formatPercent(stock.changePercent)}</span>
        </span>
      </Link>
      <button onClick={() => onRemove(stock.symbol)} className="ml-2 shrink-0 text-positive/60 active:text-negative transition-colors">
        <Star className="h-4 w-4 fill-current" />
      </button>
    </div>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Load watchlist on mount only — no re-fetch on symbol changes
  useEffect(() => {
    const syms = readWatchlist();
    setSymbols(syms);
    if (!syms.length) { setLoading(false); return; }
    const ctrl = new AbortController();
    fetch(`/api/market?watchlist=${syms.join(",")}`, { signal: ctrl.signal })
      .then(r => r.json() as Promise<{ tickerStocks?: StockSummary[] }>)
      .then(d => {
        const map = new Map((d.tickerStocks ?? []).map(s => [s.symbol, s]));
        // Preserve watchlist order and include all symbols (even if API didn't return them)
        setStocks(syms.map(sym => map.get(sym)).filter(Boolean) as StockSummary[]);
      })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, []);

  function handleRemove(symbol: string) {
    // Update localStorage and state directly — no re-fetch needed
    removeFromWatchlist(symbol);
    setSymbols(prev => prev.filter(s => s !== symbol));
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
  }

  return (
    <div className="pb-24">
      <div className="px-4 pt-6 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-positive">Watchlist</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Your Stocks</h1>
      </div>

      {loading ? (
        <LoadingScreen label="Loading your watchlist" />
      ) : !stocks.length ? (
        <div className="mx-4 rounded-xl border border-dashed border-border-subtle p-8 text-center">
          <Star className="h-8 w-8 mx-auto mb-3 text-text-muted/40" />
          <p className="text-sm font-semibold text-text-primary mb-1">No stocks yet</p>
          <p className="text-xs text-text-muted">Search for a stock and tap the star to add it.</p>
        </div>
      ) : (
        <div className="mx-4 rounded-xl border border-border-subtle bg-panel overflow-hidden">
          {stocks.map(s => <WatchlistRow key={s.symbol} stock={s} onRemove={handleRemove} />)}
        </div>
      )}
    </div>
  );
}
