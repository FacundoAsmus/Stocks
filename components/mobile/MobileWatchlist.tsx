"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Reorder, useDragControls } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Star } from "lucide-react";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { TopBlur } from "@/components/EdgeBlur";
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
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 14; // movement before the long-press timer fires cancels it — generous enough to tolerate natural hand tremor while holding still

function withResistance(raw: number) {
  if (raw >= -REVEAL_WIDTH) return raw;
  const excess = -REVEAL_WIDTH - raw;
  const damped = OVERDRAG_MAX * (1 - Math.exp(-excess / OVERDRAG_MAX));
  return -REVEAL_WIDTH - damped;
}

const SETTLE_TRANSITION = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

// One row. Reordering itself (the vertical drag + smooth reflow of
// siblings) is entirely delegated to Framer Motion's Reorder.Item — it's
// only *activated* after our own long-press timer fires, via dragControls,
// so a quick tap or a horizontal swipe never accidentally starts a drag.
// The horizontal swipe-to-reveal-delete gesture stays hand-rolled (Framer's
// Reorder locks the drag axis to "y", so it doesn't touch this at all).
function WatchlistRow({ stock, onRemove }: { stock: StockSummary; onRemove: (s: string) => void }) {
  const rowRef    = useRef<HTMLDivElement>(null);
  const innerRef  = useRef<HTMLAnchorElement>(null);
  const dragControls = useDragControls();

  const dragXRef       = useRef(0);
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

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startRef.current = {
        x: e.clientX, y: e.clientY, startDragX: dragXRef.current,
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
          if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* ignore */ } }
          // Lock out native scrolling on this row for the duration of the
          // drag — otherwise touch-action: pan-y (needed so ordinary
          // scrolling still works the rest of the time) lets the browser
          // keep treating vertical finger movement as "scroll the page"
          // even after Framer takes over, and the browser wins that race.
          if (el) el.style.touchAction = "none";
          // Hand off to Framer Motion — it takes pointer capture from here
          // and drives the drag + sibling reflow itself.
          dragControls.start(e, { snapToCursor: false });
        }, LONG_PRESS_MS);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (longPressFired.current) return; // Framer owns the gesture now

      const start = startRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (!start.decided) {
        if (Math.abs(dx) < MOVE_CANCEL_PX && Math.abs(dy) < MOVE_CANCEL_PX) return; // wait for intent — tolerate natural hand tremor while holding still
        start.decided = true;
        start.isH     = Math.abs(dx) > Math.abs(dy) * 1.15; // slight bias toward "this is a scroll", the more common gesture
        clearLongPress(); // real movement — this isn't a long-press-and-hold

        if (!start.isH) {
          // Vertical intent: this is an ordinary scroll. `touch-action: pan-y`
          // on the row means the browser has been handling this natively —
          // with full native momentum — the whole time, so there's nothing
          // for us to do here; just stop tracking it as a possible swipe.
          startRef.current = null;
          return;
        }
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

    function onPointerEnd() {
      clearLongPress();

      if (longPressFired.current) {
        longPressFired.current = false;
        if (el) el.style.touchAction = "pan-y";
        return; // Framer handles the rest of its own gesture lifecycle
      }

      if (!startRef.current?.isH) { startRef.current = null; return; }
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
      clearLongPress();
      el.removeEventListener("pointerdown",   onPointerDown);
      el.removeEventListener("pointermove",   onPointerMove);
      el.removeEventListener("pointerup",     onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [dragControls]);

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
      style={{ touchAction: "pan-y", WebkitTouchCallout: "none" }}
      whileDrag={{ scale: 1.03, boxShadow: "0 16px 40px rgba(0,0,0,0.55)", zIndex: 10 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onDragEnd={() => { if (rowRef.current) rowRef.current.style.touchAction = "pan-y"; }}
    >
      <div ref={rowRef}>
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
    </Reorder.Item>
  );
}

export function MobileWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks]   = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(100);
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
      {/* Blur ends exactly where this header does — content below stays
          fully crisp, never bleed-blurred. */}
      <TopBlur height={headerHeight} />

      <div
        ref={(el) => { if (el) setHeaderHeight(el.offsetHeight); }}
        className="sticky top-0 z-30 px-4 pb-4"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-positive">Watchlist</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Your Stocks</h1>
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
            <WatchlistRow key={stock.symbol} stock={stock} onRemove={handleRemove} />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}
