"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// ─── Row visual (shared by the real row and the floating drag ghost) ───────
function RowContent({ stock }: { stock: StockSummary }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <>
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
    </>
  );
}

// ─── Green outline marking which stock will swap places ────────────────────
const SWAP_TARGET_CLASS = "ring-2 ring-inset ring-positive shadow-[0_0_16px_rgba(0,200,5,0.35)]";

const REVEAL_WIDTH = 76;
const OVERDRAG_MAX = 28;
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 14; // movement before the long-press timer fires cancels it — generous enough to tolerate natural hand tremor while holding still

function withResistance(raw: number) {
  if (raw >= -REVEAL_WIDTH) return raw;
  const excess = -REVEAL_WIDTH - raw;
  const damped = OVERDRAG_MAX * (1 - Math.exp(-excess / OVERDRAG_MAX));
  return -REVEAL_WIDTH - damped;
}

const SETTLE_TRANSITION = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

function WatchlistRow({
  stock,
  index,
  isDragSource,
  isSwapTarget,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  stock: StockSummary;
  index: number;
  isDragSource: boolean;
  isSwapTarget: boolean;
  onRemove: (s: string) => void;
  onDragStart: (index: number, rowEl: HTMLElement, clientY: number) => void;
  onDragMove: (clientY: number) => void;
  onDragEnd: (clientY: number, clientX: number) => void;
}) {
  const rowRef   = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLAnchorElement>(null);

  // Refs for drag state to avoid re-renders mid-gesture
  const dragXRef       = useRef(0);
  const draggingRef    = useRef(false);
  const revealedRef    = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const startRef = useRef<{
    x: number; y: number; startDragX: number;
    decided: boolean; isH: boolean;
  } | null>(null);

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

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      startRef.current = {
        x: t.clientX, y: t.clientY, startDragX: dragXRef.current,
        decided: false, isH: false,
      };
      longPressFired.current = false;
      clearLongPress();
      // Only offer drag-to-reorder from a row's resting position (not mid-swipe).
      if (dragXRef.current === 0) {
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          longPressFired.current = true;
          startRef.current = null; // stop any swipe-gesture bookkeeping
          if (rowRef.current) {
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* ignore */ } }
            onDragStart(index, rowRef.current, t.clientY);
          }
        }, LONG_PRESS_MS);
      }
    }

    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];

      if (longPressFired.current) {
        // Drag engaged — take the gesture over completely, this is the one
        // case where we actively stop the page from scrolling.
        e.preventDefault();
        onDragMove(t.clientY);
        return;
      }

      const start = startRef.current;
      if (!start) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      if (!start.decided) {
        if (Math.abs(dx) < MOVE_CANCEL_PX && Math.abs(dy) < MOVE_CANCEL_PX) return; // wait for intent — tolerate natural hand tremor while holding still
        start.decided = true;
        start.isH     = Math.abs(dx) > Math.abs(dy) * 1.15; // slight bias toward "this is a scroll", the more common gesture
        clearLongPress(); // real movement — this isn't a long-press-and-hold

        if (!start.isH) {
          // Vertical intent: this is an ordinary scroll. `touch-action: pan-y`
          // on the row (see JSX below) means the browser has been handling
          // this natively — with full native momentum — the whole time, so
          // there's nothing for us to do here; just stop tracking it as a
          // possible swipe/drag.
          startRef.current = null;
          return;
        }
        draggingRef.current = true;
      }

      if (!start.isH) return;

      // Horizontal swipe-to-reveal: override the browser's default (which
      // would otherwise fight us) only for this axis.
      e.preventDefault();
      e.stopPropagation();

      const raw  = start.startDragX + dx;
      const next = raw > 0 ? 0 : withResistance(raw);
      dragXRef.current = next;
      applyX(next, false);
    }

    function onTouchEnd(e: TouchEvent) {
      clearLongPress();

      if (longPressFired.current) {
        longPressFired.current = false;
        const t = e.changedTouches[0];
        onDragEnd(t.clientY, t.clientX);
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

    // touchstart/move are non-passive so we can preventDefault() to take
    // over horizontal swipes and an engaged long-press-drag; ordinary
    // vertical scrolling is left entirely to the browser (touch-action:
    // pan-y below) so it keeps its native momentum/inertia.
    el.addEventListener("touchstart",  onTouchStart, { passive: true });
    el.addEventListener("touchmove",   onTouchMove,  { passive: false });
    el.addEventListener("touchend",    onTouchEnd,   { passive: true });
    el.addEventListener("touchcancel", onTouchEnd,   { passive: true });

    return () => {
      clearLongPress();
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [index, onDragStart, onDragMove, onDragEnd]);

  useEffect(() => {
    function onScroll() { if (revealedRef.current) close(); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rowRef}
      data-watchlist-row
      className={cn(
        "relative overflow-hidden border-b border-border-subtle/70 last:border-0 transition-opacity duration-150",
        isSwapTarget && SWAP_TARGET_CLASS
      )}
      style={{ opacity: isDragSource ? 0 : 1, touchAction: "pan-y", WebkitTouchCallout: "none" }}
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
        onClick={(e) => { if (revealedRef.current) { e.preventDefault(); close(); } }}
        className="flex items-center gap-3 px-4 py-3.5 bg-black active:bg-panel-muted"
        style={{
          transform: "translateX(0px)",
          willChange: "transform",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        suppressHydrationWarning
      >
        <RowContent stock={stock} />
      </Link>
    </div>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks]   = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const fetchedRef            = useRef<Set<string>>(new Set());
  const containerRef          = useRef<HTMLDivElement>(null);

  // ── Drag-to-reorder state ────────────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null); // which row will be swapped with
  const [ghost, setGhost] = useState<{ stock: StockSummary; top: number; left: number; width: number; height: number } | null>(null);

  const dragOffsetYRef   = useRef(0);      // finger-to-row-top offset, kept constant while dragging
  const rowRectsRef      = useRef<{ top: number; height: number }[]>([]);
  const containerRectRef = useRef<DOMRect | null>(null);
  const hoverIndexRef    = useRef<number | null>(null);
  const dragIndexRef     = useRef<number | null>(null);
  const symbolsRef       = useRef<string[]>([]);
  const stocksMapRef     = useRef<Map<string, StockSummary>>(new Map());

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
    symbolsRef.current = symbols;
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

  useEffect(() => { stocksMapRef.current = stocks; }, [stocks]);

  function handleRemove(symbol: string) {
    const updated = symbols.filter(s => s !== symbol);
    setSymbols(updated);
    writeWatchlist(updated);
  }

  // Given the ghost card's vertical center, find which row it's currently
  // sitting on top of (the one it would swap places with). Every row is
  // contiguous with no gaps, so any Y within the list's vertical span maps
  // to exactly one row; outside that span (or the drag's own original row)
  // there's no valid swap target.
  function computeHoverIndex(ghostCenterY: number, excludeIndex: number): number | null {
    const rects = rowRectsRef.current;
    for (let i = 0; i < rects.length; i++) {
      if (i === excludeIndex) continue;
      if (ghostCenterY >= rects[i].top && ghostCenterY <= rects[i].top + rects[i].height) return i;
    }
    return null;
  }

  const handleDragStart = useCallback((index: number, rowEl: HTMLElement, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rowRect = rowEl.getBoundingClientRect();
    containerRectRef.current = container.getBoundingClientRect();

    // Snapshot every row's current position so hit-testing stays stable
    // for the whole gesture even though the real rows don't move.
    const rowEls = Array.from(container.querySelectorAll<HTMLElement>("[data-watchlist-row]"));
    rowRectsRef.current = rowEls.map(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top, height: r.height };
    });

    dragOffsetYRef.current = clientY - rowRect.top;
    const symbol = symbolsRef.current[index];
    const stock  = symbol ? stocksMapRef.current.get(symbol) : undefined;

    dragIndexRef.current = index;
    setDragIndex(index);
    hoverIndexRef.current = null;
    setHoverIndex(null);
    if (stock) {
      setGhost({
        stock,
        top: rowRect.top,
        left: rowRect.left,
        width: rowRect.width,
        height: rowRect.height,
      });
    }
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    const top = clientY - dragOffsetYRef.current;
    setGhost(g => g ? { ...g, top } : g);
    if (dragIndexRef.current === null) return;
    const ghostHeight = rowRectsRef.current[dragIndexRef.current]?.height ?? 0;
    const centerY = top + ghostHeight / 2;
    const next = computeHoverIndex(centerY, dragIndexRef.current);
    if (hoverIndexRef.current !== next) {
      hoverIndexRef.current = next;
      setHoverIndex(next);
    }
  }, []);

  const handleDragEnd = useCallback((clientY: number, clientX: number) => {
    const rect = containerRectRef.current;
    const margin = 48; // small tolerance so releasing right at the edge still counts
    const withinBounds = !!rect
      && clientX >= rect.left - margin && clientX <= rect.right + margin
      && clientY >= rect.top - margin && clientY <= rect.bottom + margin;

    const from = dragIndexRef.current;
    const to   = hoverIndexRef.current;

    if (withinBounds && from !== null && to !== null && to !== from) {
      const updated = [...symbolsRef.current];
      // Swap — the dragged stock and the one it's hovering over trade places.
      [updated[from], updated[to]] = [updated[to], updated[from]];
      symbolsRef.current = updated;
      setSymbols(updated);
      writeWatchlist(updated);
    }

    dragIndexRef.current  = null;
    hoverIndexRef.current = null;
    setDragIndex(null);
    setHoverIndex(null);
    setGhost(null);
  }, []);

  const orderedStocks = symbols.map(s => stocks.get(s)).filter(Boolean) as StockSummary[];

  if (loading && !orderedStocks.length) return <LoadingScreen label="Loading your watchlist" />;

  const rowNodes = orderedStocks.map((stock, i) => (
    <WatchlistRow
      key={stock.symbol}
      stock={stock}
      index={i}
      isDragSource={dragIndex === i}
      isSwapTarget={dragIndex !== null && hoverIndex === i}
      onRemove={handleRemove}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    />
  ));

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
        <div ref={containerRef} className="mx-4 mt-6 rounded-xl bg-black overflow-hidden">
          {rowNodes}
        </div>
      )}

      {/* Floating drag ghost — follows the finger while reordering */}
      {ghost && (
        <div
          className="fixed z-50 flex items-center gap-3 px-4 py-3.5 rounded-xl border border-positive/50 bg-black shadow-[0_16px_40px_rgba(0,0,0,0.55)] scale-[1.03] pointer-events-none"
          style={{ top: ghost.top, left: ghost.left, width: ghost.width, height: ghost.height }}
        >
          <RowContent stock={ghost.stock} />
        </div>
      )}
    </div>
  );
}
