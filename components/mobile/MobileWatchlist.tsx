"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
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
    <div className="h-10 w-20 shrink-0 pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide width={0} />
          <Area
            type="monotone"
            dataKey="close"
            stroke={isPos ? "#00c805" : "#ff3003"}
            fill="transparent"
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RowContent({ stock }: { stock: StockSummary }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <>
      {stock.logo ? (
        <img
          src={stock.logo}
          alt=""
          className="h-9 w-9 rounded-md border border-white/10 bg-white/5 object-contain shrink-0 pointer-events-none"
        />
      ) : (
        <span className="h-9 w-9 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary shrink-0 pointer-events-none">
          {stock.symbol.replace("^", "").slice(0, 2)}
        </span>
      )}
      <span className="flex-1 min-w-0 pointer-events-none">
        <span className="block text-sm font-bold text-text-primary truncate">{stock.symbol}</span>
      </span>
      <MiniSparkline stock={stock} />
      <span className="ml-3 shrink-0 pointer-events-none">
        <span
          className={cn(
            "inline-block text-sm font-bold text-black px-3 py-1 rounded-lg",
            isPos ? "bg-positive" : "bg-negative"
          )}
        >
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

function WatchlistRow({
  stock,
  onRemove,
}: {
  stock: StockSummary;
  onRemove: (s: string) => void;
}) {
  const router = useRouter();
  const innerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const dragXRef = useRef(0);
  const revealedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; startDragX: number; decided: boolean } | null>(null);

  // Long press refs & state
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function applyX(x: number, animate: boolean) {
    const el = innerRef.current;
    if (!el) return;
    el.style.transition = animate ? SETTLE_TRANSITION : "none";
    el.style.transform = `translateX(${x}px)`;
  }

  function close() {
    dragXRef.current = 0;
    revealedRef.current = false;
    applyX(0, true);
  }

  // Handle horizontal swipe-to-delete & long-press reorder via Pointer Events
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    function clearTimer() {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      
      startRef.current = { x: e.clientX, y: e.clientY, startDragX: dragXRef.current, decided: false };
      pointerStartPos.current = { x: e.clientX, y: e.clientY };

      clearTimer();

      // Trigger reorder drag after holding stationary for 300ms
      longPressTimer.current = setTimeout(() => {
        if (navigator.vibrate) {
          try {
            navigator.vibrate(20);
          } catch {
            /* ignore */
          }
        }

        // Lock document scroll completely
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        setIsDragging(true);

        // Pass native PointerEvent directly to Framer Motion
        dragControls.start(e, { snapToCursor: false });
      }, 300);
    }

    function onPointerMove(e: PointerEvent) {
      // Cancel long press if pointer moves > 8px before timer fires
      if (pointerStartPos.current && !isDragging) {
        const dx = Math.abs(e.clientX - pointerStartPos.current.x);
        const dy = Math.abs(e.clientY - pointerStartPos.current.y);
        if (dx > 8 || dy > 8) {
          clearTimer();
        }
      }

      // Handle horizontal swipe reveal
      const start = startRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (!start.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        start.decided = true;
        if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
          startRef.current = null;
          return;
        }
      }

      e.preventDefault();
      const raw = start.startDragX + dx;
      const next = raw > 0 ? 0 : withResistance(raw);
      dragXRef.current = next;
      applyX(next, false);
    }

    function onPointerEnd() {
      clearTimer();

      if (!startRef.current) return;
      const shouldReveal = dragXRef.current < -REVEAL_WIDTH / 2;
      const target = shouldReveal ? -REVEAL_WIDTH : 0;
      dragXRef.current = target;
      revealedRef.current = shouldReveal;
      applyX(target, true);
      startRef.current = null;
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerEnd, { passive: true });
    el.addEventListener("pointercancel", onPointerEnd, { passive: true });

    return () => {
      clearTimer();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [dragControls, isDragging]);

  useEffect(() => {
    function onScroll() {
      if (revealedRef.current) close();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleDragEnd = () => {
    setIsDragging(false);
    // Restore document scroll after dropping
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  };

  return (
    <Reorder.Item
      value={stock.symbol}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      className="relative overflow-hidden border-b border-border-subtle/70 last:border-0 bg-black select-none"
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
        zIndex: 50,
      }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onDragEnd={handleDragEnd}
      style={{
        touchAction: isDragging ? "none" : "pan-y",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div className="relative">
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center"
          style={{ width: REVEAL_WIDTH }}
        >
          <button
            onClick={() => onRemove(stock.symbol)}
            aria-label={`Remove ${stock.symbol}`}
            className="flex items-center justify-center text-positive active:scale-90 transition-transform"
          >
            <Star className="h-5 w-5 fill-current" />
          </button>
        </div>

        <div
          ref={innerRef}
          className="flex items-center gap-1 pl-4 pr-4 py-3.5 bg-black"
          style={{
            transform: "translateX(0px)",
            willChange: "transform",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          suppressHydrationWarning
        >
          <div
            className="flex items-center gap-3 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
            onClick={() => {
              if (isDragging) return;
              if (revealedRef.current) {
                close();
                return;
              }
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
  const [stocks, setStocks] = useState<Map<string, StockSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    const missing = symbols.filter((s) => !fetchedRef.current.has(s));
    if (!missing.length) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/market?watchlist=${missing.join(",")}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ tickerStocks?: StockSummary[] }>)
      .then((d) => {
        const fetched = d.tickerStocks ?? [];
        fetched.forEach((s) => fetchedRef.current.add(s.symbol));
        setStocks((prev) => {
          const next = new Map(prev);
          fetched.forEach((s) => next.set(s.symbol, s));
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [symbols]);

  function handleRemove(symbol: string) {
    const updated = symbols.filter((s) => s !== symbol);
    setSymbols(updated);
    writeWatchlist(updated);
  }

  function handleReorder(newOrder: string[]) {
    if (newOrder.length !== symbols.length) return;
    setSymbols(newOrder);
    writeWatchlist(newOrder);
  }

  const orderedStocks = symbols.map((s) => stocks.get(s)).filter(Boolean) as StockSummary[];

  if (loading && !orderedStocks.length) return <LoadingScreen label="Loading your watchlist" />;

  return (
    <div className="pb-24">
      <div
        className="sticky top-0 z-30 px-4 pb-4 flex items-end justify-between gap-3 bg-black/80 backdrop-blur-md"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive">Watchlist</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Your Stocks</h1>
        </div>
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
          values={orderedStocks.map((s) => s.symbol)}
          onReorder={handleReorder}
          className="mx-4 mt-2 rounded-xl bg-black"
        >
          {orderedStocks.map((stock) => (
            <WatchlistRow key={stock.symbol} stock={stock} onRemove={handleRemove} />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}