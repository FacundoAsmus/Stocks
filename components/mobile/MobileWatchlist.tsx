"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

// ── Drag-to-reorder watchlist row ─────────────────────────────────────────
interface DraggableRowProps {
  stock: StockSummary;
  index: number;
  total: number;
  onRemove: (s: string) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onLongPress: (index: number, clientY: number) => void;
  onDragMove: (clientY: number) => void;
  onDragEnd: () => void;
}

function DraggableRow({
  stock, index, onRemove, isDragging, isDropTarget, onLongPress, onDragMove, onDragEnd,
}: DraggableRowProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPos = (stock.changePercent ?? 0) >= 0;

  function handleTouchStart(e: React.TouchEvent) {
    const clientY = e.touches[0].clientY;
    longPressTimer.current = setTimeout(() => {
      onLongPress(index, clientY);
    }, 400);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging) {
      e.preventDefault();
      onDragMove(e.touches[0].clientY);
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging) onDragEnd();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border-subtle/70 last:border-0 transition-all duration-150 select-none",
        isDragging && "opacity-40 scale-95",
        isDropTarget && "ring-2 ring-positive ring-inset bg-positive/5",
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: isDragging ? "none" : "auto" }}
    >
      <Link
        href={isDragging ? "#" : `/stock/${stock.symbol}`}
        className="flex items-center gap-3 flex-1 min-w-0"
        onClick={isDragging ? (e) => e.preventDefault() : undefined}
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
      {/* Drag handle hint when not dragging */}
      <div className="flex flex-col gap-[3px] ml-1 shrink-0 opacity-20">
        {[0,1,2].map(i => <span key={i} className="h-px w-4 bg-text-muted rounded" />)}
      </div>
      <button
        onClick={() => onRemove(stock.symbol)}
        className="ml-1 shrink-0 text-positive active:text-negative transition-colors p-1"
        aria-label={`Remove ${stock.symbol}`}
      >
        <Star className="h-4 w-4 fill-current" />
      </button>
    </div>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols]   = useState<string[]>([]);
  const [stocks, setStocks]     = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading]   = useState(true);
  const fetchedRef              = useRef<Set<string>>(new Set());

  // Drag state
  const [dragIndex,   setDragIndex]   = useState<number | null>(null);
  const [dropIndex,   setDropIndex]   = useState<number | null>(null);
  const rowHeightRef                  = useRef(64); // estimated row height in px
  const dragStartYRef                 = useRef(0);
  const listRef                       = useRef<HTMLDivElement>(null);

  // Sync watchlist from localStorage
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

  // Fetch missing stock data
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

  // ── Drag-to-reorder handlers ───────────────────────────────────────────
  const handleLongPress = useCallback((index: number, clientY: number) => {
    dragStartYRef.current = clientY;
    // Estimate row height from list DOM
    if (listRef.current) {
      const rows = listRef.current.querySelectorAll("[data-row]");
      if (rows.length > 0) {
        rowHeightRef.current = rows[0].getBoundingClientRect().height || 64;
      }
    }
    setDragIndex(index);
    setDropIndex(index);
    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (dragIndex === null) return;
    const delta = clientY - dragStartYRef.current;
    const moved = Math.round(delta / rowHeightRef.current);
    const newDrop = Math.max(0, Math.min(symbols.length - 1, dragIndex + moved));
    setDropIndex(newDrop);
  }, [dragIndex, symbols.length]);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const reordered = [...symbols];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dropIndex, 0, moved);
      setSymbols(reordered);
      writeWatchlist(reordered);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, symbols]);

  const orderedStocks = symbols.map(s => stocks.get(s)).filter(Boolean) as StockSummary[];
  const isLoading     = loading && !orderedStocks.length;

  if (isLoading) return <LoadingScreen label="Loading your watchlist" />;

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
        <div ref={listRef} className="mx-4 rounded-xl bg-black overflow-hidden">
          {orderedStocks.map((stock, index) => (
            <DraggableRow
              key={stock.symbol}
              stock={stock}
              index={index}
              total={orderedStocks.length}
              onRemove={handleRemove}
              isDragging={dragIndex === index}
              isDropTarget={dropIndex === index && dragIndex !== index}
              onLongPress={handleLongPress}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
