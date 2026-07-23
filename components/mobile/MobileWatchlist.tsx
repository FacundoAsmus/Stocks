"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { GripVertical, Star } from "lucide-react";

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

const REVEAL_WIDTH = 76;
const OVERDRAG_MAX = 28;

function withResistance(raw: number) {
  if (raw >= -REVEAL_WIDTH) return raw;
  const excess = -REVEAL_WIDTH - raw;
  const damped = OVERDRAG_MAX * (1 - Math.exp(-excess / OVERDRAG_MAX));
  return -REVEAL_WIDTH - damped;
}

const SETTLE_TRANSITION = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

// One row, in one of two modes:
//
// - Browsing (isEditing=false): tap navigates, swipe left reveals a remove
//   button. No drag-to-reorder here at all — trying to make "long-press
//   this same element to start a drag" reliably beat native scrolling on
//   iOS Safari, with zero visible affordance, turned out to be an
//   unwinnable race condition no matter how it was implemented.
//
// - Editing (isEditing=true, toggled from the "Edit" button in the header):
//   a dedicated grip handle appears. Because that handle has
//   touch-action: none from the very first touch on it — not changed
//   later, unlike the old approach — iOS never has a chance to start a
//   native scroll there in the first place, so there's no race at all.
//   Tap-to-navigate and swipe-to-remove are disabled while editing, same
//   as native iOS list-editing (e.g. Settings, Reminders).
function WatchlistRow({
  stock, onRemove, isEditing,
}: { stock: StockSummary; onRemove: (s: string) => void; isEditing: boolean }) {
  const router    = useRouter();
  const innerRef  = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const dragXRef       = useRef(0);
  const revealedRef    = useRef(false);
  const startRef = useRef<{ x: number; y: number; startDragX: number; decided: boolean } | null>(null);

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

  // Reset any open swipe state whenever edit mode toggles, so rows don't
  // get stuck mid-swipe when switching modes.
  useEffect(() => { close(); }, [isEditing]);

  useEffect(() => {
    if (isEditing) return; // swipe-to-remove is only active while browsing
    const el = innerRef.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY, startDragX: dragXRef.current, decided: false };
    }

    function onPointerMove(e: PointerEvent) {
      const start = startRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (!start.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        start.decided = true;
        if (Math.abs(dx) <= Math.abs(dy) * 1.15) { startRef.current = null; return; } // vertical: let native scroll handle it
      }

      e.preventDefault();
      const raw  = start.startDragX + dx;
      const next = raw > 0 ? 0 : withResistance(raw);
      dragXRef.current = next;
      applyX(next, false);
    }

    function onPointerEnd() {
      if (!startRef.current) return;
      const shouldReveal = dragXRef.current < -REVEAL_WIDTH / 2;
      const target       = shouldReveal ? -REVEAL_WIDTH : 0;
      dragXRef.current   = target;
      revealedRef.current = shouldReveal;
      applyX(target, true);
      startRef.current    = null;
    }

    el.addEventListener("pointerdown",   onPointerDown, { passive: true });
    el.addEventListener("pointermove",   onPointerMove, { passive: false });
    el.addEventListener("pointerup",     onPointerEnd,  { passive: true });
    el.addEventListener("pointercancel", onPointerEnd,  { passive: true });
    return () => {
      el.removeEventListener("pointerdown",   onPointerDown);
      el.removeEventListener("pointermove",   onPointerMove);
      el.removeEventListener("pointerup",     onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [isEditing]);

  useEffect(() => {
    function onScroll() { if (revealedRef.current) close(); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Reorder.Item
      value={stock.symbol}
      dragListener={false}
      dragControls={dragControls}
      as="div"
      className="relative overflow-hidden border-b border-border-subtle/70 last:border-0 bg-black"
      whileDrag={{ scale: 1.03, boxShadow: "0 16px 40px rgba(0,0,0,0.55)", zIndex: 10 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    >
      <div className="relative">
        {/* Swipe-revealed remove button (browsing mode only) */}
        {!isEditing && (
          <div className="absolute inset-y-0 right-0 flex items-center justify-center" style={{ width: REVEAL_WIDTH }}>
            <button
              onClick={() => onRemove(stock.symbol)}
              aria-label={`Remove ${stock.symbol}`}
              className="flex items-center justify-center text-positive active:scale-90 transition-transform"
            >
              <Star className="h-5 w-5 fill-current" />
            </button>
          </div>
        )}

        <div
          ref={innerRef}
          className="flex items-center gap-1 pl-1 pr-4 py-3.5 bg-black"
          style={{
            transform: "translateX(0px)",
            willChange: "transform",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          suppressHydrationWarning
        >
          {isEditing && (
            <>
              <button
                type="button"
                onClick={() => onRemove(stock.symbol)}
                aria-label={`Remove ${stock.symbol}`}
                className="flex items-center justify-center shrink-0 h-7 w-7 rounded-full bg-negative text-white active:scale-90 transition-transform"
              >
                <span className="text-lg leading-none">−</span>
              </button>
              {/* Dedicated drag handle: touch-action is "none" from the very
                  first touch on it, so iOS never gets a chance to start a
                  native scroll here — no race condition, no delay needed. */}
              <button
                type="button"
                aria-label={`Reorder ${stock.symbol}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* ignore */ } }
                  dragControls.start(e, { snapToCursor: false });
                }}
                className="flex items-center justify-center shrink-0 h-9 w-8 text-text-muted/50 active:text-text-muted"
                style={{ touchAction: "none", WebkitTouchCallout: "none" }}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            </>
          )}
          <div
            className="flex items-center gap-3 flex-1 min-w-0"
            onClick={() => {
              if (isEditing) return;
              if (revealedRef.current) { close(); return; }
              router.push(`/stock/${stock.symbol}`);
            }}
          >
            <RowContent stock={stock} />
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks]   = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
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

  function handleReorder(newOrder: string[]) {
    // Guard: only commit if every currently-tracked symbol is accounted for
    // (i.e. nothing is still mid-fetch) — avoids silently dropping a symbol
    // that hasn't loaded into `stocks` yet.
    if (newOrder.length !== symbols.length) return;
    setSymbols(newOrder);
    writeWatchlist(newOrder);
  }

  const orderedStocks = symbols.map(s => stocks.get(s)).filter(Boolean) as StockSummary[];

  if (loading && !orderedStocks.length) return <LoadingScreen label="Loading your watchlist" />;

  return (
    <div className="pb-24">
      <div
        className="sticky top-0 z-30 px-4 pb-4 flex items-end justify-between gap-3"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive">Watchlist</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Your Stocks</h1>
        </div>
        {orderedStocks.length > 0 && (
          <button
            type="button"
            onClick={() => setIsEditing(v => !v)}
            className={cn(
              "shrink-0 text-sm font-semibold px-3 py-1.5 rounded-lg mb-1",
              isEditing ? "bg-positive text-black" : "bg-panel-muted text-text-primary"
            )}
          >
            {isEditing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {orderedStocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <p className="text-lg font-semibold text-text-primary">Your watchlist is empty</p>
          <p className="text-sm text-text-muted">Search for stocks to add them.</p>
        </div>
      ) : (
        <Reorder.Group
          as="div"
          axis="y"
          values={orderedStocks.map(s => s.symbol)}
          onReorder={handleReorder}
          className="mx-4 mt-6 rounded-xl bg-black"
        >
          {orderedStocks.map(stock => (
            <WatchlistRow key={stock.symbol} stock={stock} onRemove={handleRemove} isEditing={isEditing} />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}
