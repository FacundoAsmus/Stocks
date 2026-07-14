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
const LONG_PRESS_MS = 450;
const MOVE_DECIDE_PX = 5;

function WatchlistRow({
  stock,
  onRemove,
  isDragging,
  dragOffsetY,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  onReorderCancel,
  registerRef,
}: {
  stock: StockSummary;
  onRemove: (s: string) => void;
  isDragging: boolean;
  dragOffsetY: number;
  onReorderStart: (symbol: string, clientY: number) => void;
  onReorderMove: (clientY: number) => void;
  onReorderEnd: (clientY: number) => void;
  onReorderCancel: () => void;
  registerRef: (symbol: string, el: HTMLDivElement | null) => void;
}) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const rowRef   = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLAnchorElement>(null);

  // Use refs for drag state to avoid re-renders mid-gesture
  const dragXRef     = useRef(0);
  const draggingRef  = useRef(false);
  const revealedRef  = useRef(false);
  const startRef     = useRef<{ x: number; y: number; startDragX: number; decided: boolean; isH: boolean } | null>(null);

  // Long-press-to-reorder state
  const longPressTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorderActiveRef   = useRef(false);
  const suppressClickRef   = useRef(false);

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

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY, startDragX: dragXRef.current, decided: false, isH: false };
      reorderActiveRef.current = false;
      clearLongPressTimer();
      // Hold still for LONG_PRESS_MS to pick the row up for reordering.
      // Any decisive movement before then (a swipe or a scroll) cancels this.
      longPressTimerRef.current = setTimeout(() => {
        if (startRef.current && !startRef.current.decided) {
          reorderActiveRef.current = true;
          startRef.current.decided = true;
          onReorderStart(stock.symbol, startRef.current.y);
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
        }
      }, LONG_PRESS_MS);
    }

    function onTouchMove(e: TouchEvent) {
      if (reorderActiveRef.current) {
        e.preventDefault();
        onReorderMove(e.touches[0].clientY);
        return;
      }

      const start = startRef.current;
      if (!start) return;
      const t  = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      if (!start.decided) {
        if (Math.abs(dx) < MOVE_DECIDE_PX && Math.abs(dy) < MOVE_DECIDE_PX) return;   // wait for intent
        clearLongPressTimer(); // real movement — this isn't a long-press hold
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

    function onTouchEnd(e: TouchEvent) {
      clearLongPressTimer();

      if (reorderActiveRef.current) {
        reorderActiveRef.current = false;
        suppressClickRef.current = true;
        const t = e.changedTouches[0];
        onReorderEnd(t ? t.clientY : startRef.current?.y ?? 0);
        startRef.current = null;
        return;
      }

      if (!startRef.current?.isH) { startRef.current = null; draggingRef.current = false; return; }
      const shouldReveal = dragXRef.current < -REVEAL_WIDTH / 2;
      const target       = shouldReveal ? -REVEAL_WIDTH : 0;
      dragXRef.current   = target;
      revealedRef.current = shouldReveal;
      applyX(target, true);
      draggingRef.current = false;
      startRef.current    = null;
    }

    function onTouchCancelHandler() {
      clearLongPressTimer();
      if (reorderActiveRef.current) {
        reorderActiveRef.current = false;
        suppressClickRef.current = true;
        onReorderCancel();
      }
      startRef.current = null;
      draggingRef.current = false;
    }

    el.addEventListener("touchstart",  onTouchStart, { passive: true });
    el.addEventListener("touchmove",   onTouchMove,  { passive: false });
    el.addEventListener("touchend",    onTouchEnd,   { passive: true });
    el.addEventListener("touchcancel", onTouchCancelHandler, { passive: true });

    return () => {
      clearLongPressTimer();
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancelHandler);
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
    <div
      ref={(el) => { rowRef.current = el; registerRef(stock.symbol, el); }}
      className="relative overflow-hidden border-b border-border-subtle/70 last:border-0"
      style={{
        transform: isDragging ? `translateY(${dragOffsetY}px) scale(1.02)` : "none",
        transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: isDragging ? 20 : "auto",
        boxShadow: isDragging ? "0 12px 28px rgba(0,0,0,0.55)" : "none",
        borderRadius: isDragging ? 12 : 0,
        position: "relative",
      }}
    >
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
        onClick={(e) => {
          if (suppressClickRef.current) { suppressClickRef.current = false; e.preventDefault(); return; }
          if (revealedRef.current) { e.preventDefault(); close(); }
        }}
        className={cn(
          "flex items-center gap-3 px-4 py-3.5 bg-black active:bg-panel-muted",
          isDragging && "bg-panel-muted"
        )}
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

  // Reorder-by-long-press state
  const [dragSymbol, setDragSymbol] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dropLineTop, setDropLineTop] = useState<number | null>(null);
  const dropIndexRef  = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const listRef  = useRef<HTMLDivElement>(null);
  const rowRefs  = useRef<Map<string, HTMLDivElement>>(new Map());

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

  function registerRowRef(symbol: string, el: HTMLDivElement | null) {
    if (el) rowRefs.current.set(symbol, el);
    else rowRefs.current.delete(symbol);
  }

  // Given the finger's current Y, figure out which gap between the OTHER
  // rows (i.e. everyone except the one being dragged) it's hovering over,
  // and where the green insertion line should sit to show that gap.
  function computeDropTarget(clientY: number, draggedSymbol: string) {
    const others = symbols.filter(s => s !== draggedSymbol);
    const container = listRef.current;
    if (!container) return { gapIndex: 0, lineTop: 0 };

    const containerRect = container.getBoundingClientRect();
    let gapIndex = others.length;
    let lineTop = containerRect.height;

    for (let i = 0; i < others.length; i++) {
      const el = rowRefs.current.get(others[i]);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) {
        gapIndex = i;
        lineTop = rect.top - containerRect.top;
        break;
      }
    }
    return { gapIndex, lineTop };
  }

  function handleReorderStart(symbol: string, clientY: number) {
    dragStartYRef.current = clientY;
    setDragSymbol(symbol);
    setDragOffsetY(0);
    const { gapIndex, lineTop } = computeDropTarget(clientY, symbol);
    dropIndexRef.current = gapIndex;
    setDropLineTop(lineTop);
  }

  function handleReorderMove(clientY: number) {
    setDragOffsetY(clientY - dragStartYRef.current);
    setDragSymbol(current => {
      if (!current) return current;
      const { gapIndex, lineTop } = computeDropTarget(clientY, current);
      dropIndexRef.current = gapIndex;
      setDropLineTop(lineTop);
      return current;
    });
  }

  function resetDragState() {
    setDragSymbol(null);
    setDragOffsetY(0);
    setDropLineTop(null);
    dropIndexRef.current = null;
  }

  function handleReorderEnd(clientY: number) {
    const draggedSymbol = dragSymbol;
    const container = listRef.current;
    if (!draggedSymbol || !container) { resetDragState(); return; }

    // "Lift your finger into nothing" — released outside the list entirely
    // (above the header, below the card, off to the side) — keep the
    // original order.
    const rect = container.getBoundingClientRect();
    const droppedInsideList = clientY >= rect.top && clientY <= rect.bottom;

    if (droppedInsideList && dropIndexRef.current !== null) {
      const others = symbols.filter(s => s !== draggedSymbol);
      const idx = Math.max(0, Math.min(dropIndexRef.current, others.length));
      const reordered = [...others.slice(0, idx), draggedSymbol, ...others.slice(idx)];
      setSymbols(reordered);
      writeWatchlist(reordered);
    }
    resetDragState();
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
        <div ref={listRef} className="relative mx-4 mt-6 rounded-xl bg-black overflow-hidden">
          {orderedStocks.map(stock => (
            <WatchlistRow
              key={stock.symbol}
              stock={stock}
              onRemove={handleRemove}
              isDragging={dragSymbol === stock.symbol}
              dragOffsetY={dragSymbol === stock.symbol ? dragOffsetY : 0}
              onReorderStart={handleReorderStart}
              onReorderMove={handleReorderMove}
              onReorderEnd={handleReorderEnd}
              onReorderCancel={resetDragState}
              registerRef={registerRowRef}
            />
          ))}

          {/* Green insertion line — shows exactly where the dragged stock
              would land if you let go right now. */}
          {dragSymbol && dropLineTop !== null && (
            <div
              className="absolute left-3 right-3 pointer-events-none"
              style={{
                top: dropLineTop - 1,
                height: 2,
                borderRadius: 999,
                backgroundColor: "#00c805",
                boxShadow: "0 0 8px rgba(0,200,5,0.7)",
                zIndex: 30,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
