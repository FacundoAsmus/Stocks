"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { DEFAULT_WATCHLIST } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/types/stock";
import { DesktopStockDetail } from "@/components/DesktopStockDetail";
import { WatchlistAIChatPanel } from "@/components/desktop/WatchlistAIChatPanel";
import { EmptyWatchlist } from "@/components/EmptyWatchlist";
import { ErrorState } from "@/components/ErrorState";
import type { getStockDetail } from "@/lib/finnhub";

const STORAGE_KEY = "market-lens-watchlist";

type StockDetail = Awaited<ReturnType<typeof getStockDetail>>;
type DetailPayload = {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
};

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

// Same mini sparkline treatment used on the phone watchlist rows
// (components/mobile/MobileWatchlist.tsx), reused here so the left column
// looks identical to the phone version, as requested.
function RowSparkline({ stock }: { stock: StockSummary }) {
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

// Row content mirrors RowContent in components/mobile/MobileWatchlist.tsx
// (logo/initials, symbol, sparkline, % badge) so the list reads exactly like
// the phone watchlist. isActive = this row's stock is the one currently
// loaded in the right-hand detail panel — marked with a green border.
function WatchlistListRow({
  stock,
  isActive,
  onSelect
}: {
  stock: StockSummary;
  isActive: boolean;
  onSelect: () => void;
}) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "mx-2 my-0.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-colors select-none",
        isActive ? "border-positive bg-panel-muted" : "border-transparent hover:bg-panel-muted/50"
      )}
    >
      {stock.logo ? (
        <img
          src={stock.logo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md border border-white/10 bg-white/5 object-contain pointer-events-none"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary pointer-events-none",
          stock.logo && "hidden"
        )}
      >
        {stock.symbol.replace("^", "").slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1 pointer-events-none">
        <span className="block truncate text-sm font-bold text-text-primary">{stock.symbol}</span>
      </span>
      <div className="pointer-events-none">
        <RowSparkline stock={stock} />
      </div>
      <span className="ml-1 shrink-0 pointer-events-none">
        <span
          className={cn(
            "inline-block rounded-lg px-3 py-1 text-sm font-bold text-black",
            isPos ? "bg-positive" : "bg-negative"
          )}
        >
          {formatPercent(stock.changePercent)}
        </span>
      </span>
    </div>
  );
}

// Small in-panel loader (not full-screen) so switching stocks only shows a
// loading state inside the right-hand panel, never covering the list.
function PanelLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4" role="status" aria-label={label}>
      <style>{`
        @keyframes wl-candle-breathe { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(1.4)} }
        @keyframes wl-wick-breathe   { 0%,100%{opacity:0.25;transform:scaleY(0.7)} 50%{opacity:0.9;transform:scaleY(1.3)} }
        .wl-c-1{animation:wl-candle-breathe 1.8s ease-in-out infinite -1.8s;transform-origin:bottom}
        .wl-c-2{animation:wl-candle-breathe 1.8s ease-in-out infinite -1.32s;transform-origin:bottom}
        .wl-c-3{animation:wl-candle-breathe 1.8s ease-in-out infinite -0.84s;transform-origin:bottom}
        .wl-w-1{animation:wl-wick-breathe 1.8s ease-in-out infinite -1.8s;transform-origin:bottom}
        .wl-w-2{animation:wl-wick-breathe 1.8s ease-in-out infinite -1.32s;transform-origin:bottom}
        .wl-w-3{animation:wl-wick-breathe 1.8s ease-in-out infinite -0.84s;transform-origin:bottom}
      `}</style>
      <div className="flex h-16 items-end gap-2">
        <div className="flex flex-col items-center gap-1">
          <div className="wl-w-1 h-3 w-0.5 rounded-full bg-positive/50" />
          <div className="wl-c-1 h-7 w-5 rounded-md bg-positive/50" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="wl-w-2 h-3.5 w-0.5 rounded-full bg-positive/70" />
          <div className="wl-c-2 h-11 w-5 rounded-md bg-positive/70" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="wl-w-3 h-4 w-0.5 rounded-full bg-positive" />
          <div className="wl-c-3 h-14 w-5 rounded-md bg-positive" />
        </div>
      </div>
      <span className="text-sm font-medium text-text-muted">{label}</span>
    </div>
  );
}

export function WatchlistSplitView() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [displayedStocks, setDisplayedStocks] = useState<StockSummary[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const detailColumnRef = useRef<HTMLDivElement>(null);
  // Framer Motion's Reorder.Item doesn't suppress the native click event
  // that follows a drag release — if you drop a dragged row on top of
  // another row, that OTHER row's onClick still fires as a side effect,
  // which was triggering setSelectedSymbol (looking like the page
  // "reloading" as the right panel swapped to whatever row you dropped on).
  // This flag, set for a moment right as any drag ends, lets every row's
  // onSelect ignore that spurious click.
  const justDraggedRef = useRef(false);
  // Reorder.Group's onReorder fires continuously WHILE dragging (every time
  // the dragged row crosses another row), not just once on drop. We keep the
  // list visually reordered live via displayedStocks, but only persist to
  // localStorage / notify other components once the drag actually ends —
  // otherwise every mid-drag step round-trips through the
  // "watchlist-updated" listener below, resets `symbols`, and (because the
  // fetch used to key off symbol *order*) re-triggers the full watchlist
  // fetch/loading screen mid-drag, which looked like the page reloading.
  const pendingOrderRef = useRef<string[] | null>(null);

  // ── Load watchlist symbols + summaries (same approach as components/Watchlist.tsx) ──
  useEffect(() => {
    setSymbols(readWatchlist());
    function handleStorage() {
      setSymbols(readWatchlist());
    }
    window.addEventListener("watchlist-updated", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("watchlist-updated", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // A search result picked from the header's SearchBar while on this page
  // previews that symbol in the right-hand panel — it deliberately does NOT
  // touch `symbols` (the actual watchlist), so the left-hand list is
  // unaffected until the user explicitly stars it from the detail panel.
  useEffect(() => {
    function handlePreview(e: Event) {
      const symbol = (e as CustomEvent<string>).detail;
      if (symbol) setSelectedSymbol(symbol);
    }
    window.addEventListener("watchlist-preview-symbol", handlePreview);
    return () => window.removeEventListener("watchlist-preview-symbol", handlePreview);
  }, []);

  const symbolQuery = useMemo(() => [...symbols].sort().join(","), [symbols]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStocks() {
      if (!symbolQuery) {
        setStocks([]);
        setIsListLoading(false);
        return;
      }
      setIsListLoading(true);
      setListError(null);
      try {
        const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbolQuery)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { stocks?: StockSummary[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load watchlist.");
        setStocks(data.stocks ?? []);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setListError(loadError instanceof Error ? loadError.message : "Unable to load watchlist.");
        }
      } finally {
        if (!controller.signal.aborted) setIsListLoading(false);
      }
    }
    loadStocks();
    return () => controller.abort();
  }, [symbolQuery]);

  useEffect(() => {
    const ordered = symbols
      .map((sym) => stocks.find((s) => s.symbol === sym))
      .filter((s): s is StockSummary => !!s);
    setDisplayedStocks(ordered);
  }, [stocks, symbols]);

  // ── Default selection: first stock in the list, once it's available ──
  useEffect(() => {
    if (!selectedSymbol && displayedStocks.length > 0) {
      setSelectedSymbol(displayedStocks[0].symbol);
    }
  }, [displayedStocks, selectedSymbol]);

  // ── Fetch full detail for whichever stock is selected, without navigating ──
  useEffect(() => {
    if (!selectedSymbol) return;
    const controller = new AbortController();
    async function loadDetail() {
      setIsDetailLoading(true);
      setDetailError(null);
      detailPanelRef.current?.scrollTo({ top: 0 });
      try {
        const response = await fetch(`/api/stock-detail?symbol=${encodeURIComponent(selectedSymbol!)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as DetailPayload & { error?: string };
        if (!response.ok) throw new Error(data.error ?? `Unable to load ${selectedSymbol}.`);
        setDetail(data);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setDetailError(loadError instanceof Error ? loadError.message : `Unable to load ${selectedSymbol}.`);
        }
      } finally {
        if (!controller.signal.aborted) setIsDetailLoading(false);
      }
    }
    loadDetail();
    return () => controller.abort();
  }, [selectedSymbol]);

  // ── Reorder via Framer Motion's Reorder (same mechanism as the phone
  // watchlist's drag-to-reorder). This moves the real row elements and lets
  // siblings animate out of the way to open space for the dragged row,
  // instead of the browser's native (and very transparent) HTML5 drag ghost.
  // Called continuously during the drag — updates the visible order only. ──
  function handleReorder(newSymbolOrder: string[]) {
    const reordered = newSymbolOrder
      .map((sym) => displayedStocks.find((s) => s.symbol === sym))
      .filter((s): s is StockSummary => !!s);
    setDisplayedStocks(reordered);
    pendingOrderRef.current = newSymbolOrder;
  }

  // Called once, when a drag gesture actually ends — this is the only place
  // that touches localStorage/`symbols`, so it's the only place a reorder
  // can trigger any downstream effect.
  function commitReorder() {
    const finalOrder = pendingOrderRef.current;
    pendingOrderRef.current = null;
    if (!finalOrder) return;
    setSymbols(finalOrder);
    writeWatchlist(finalOrder);
  }

  if (isListLoading) return <EmptyWatchlist isLoading />;
  if (listError) return <ErrorState title="Watchlist unavailable" message={listError} />;
  if (!displayedStocks.length) return <EmptyWatchlist />;

  return (
    <div className="watchlist-desktop-root flex w-full" style={{ height: "calc(100dvh - var(--header-height, 0px))" }}>
      {/* Left: 1/4 — its own rounded, distinctly-shaded card holding the title + list.
          Background: #0e0e0e dark / #ffffff light (see .watchlist-list-panel in globals.css).
          Page background behind it: #ececec in light mode (.watchlist-desktop-root). */}
      <div className="watchlist-list-panel m-3 flex w-[1/4] shrink-0 flex-col overflow-hidden rounded-2xl border border-border-subtle/70">
        <div className="shrink-0 px-6 pb-4 pt-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Watchlist</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">Your Stocks</h1>
        </div>
        <Reorder.Group
          as="div"
          axis="y"
          values={displayedStocks.map((s) => s.symbol)}
          onReorder={handleReorder}
          className="no-scrollbar flex-1 overflow-y-auto pb-2"
        >
          {displayedStocks.map((stock) => (
            <Reorder.Item
              key={stock.symbol}
              value={stock.symbol}
              as="div"
              whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.45)", zIndex: 20 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              onDragEnd={() => {
                justDraggedRef.current = true;
                commitReorder();
                setTimeout(() => { justDraggedRef.current = false; }, 80);
              }}
            >
              <WatchlistListRow
                stock={stock}
                isActive={stock.symbol === selectedSymbol}
                onSelect={() => {
                  if (justDraggedRef.current) return;
                  setSelectedSymbol(stock.symbol);
                }}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* Right: 3/4 — the individual stock page for whichever row is selected.
          Keeps the page's normal background. Loads in place via
          /api/stock-detail; no full page reload.
          Outer wrapper is `relative` and non-scrolling (fills the column's
          full height) so the AI panel and the earnings-calendar sheet — both
          absolutely positioned against it — are confined to this column no
          matter how far the inner content is scrolled. */}
      <div ref={detailColumnRef} className="relative w-3/4 h-full">
        <div ref={detailPanelRef} className="no-scrollbar relative h-full overflow-y-auto">
          {isDetailLoading ? (
            <PanelLoader label={`Loading ${selectedSymbol ?? "stock"} data`} />
          ) : detailError ? (
            <div className="p-8">
              <ErrorState title={`Unable to load ${selectedSymbol}`} message={detailError} />
            </div>
          ) : detail ? (
            <div className="px-6 py-8">
              <DesktopStockDetail
                stock={detail.stock}
                currentPrice={detail.currentPrice}
                sentiment={detail.sentiment}
                metrics={detail.metrics}
                chartHeightClassName="h-[320px]"
                earningsCalendarContainerRef={detailColumnRef}
              />
            </div>
          ) : null}
        </div>

        {detail && (
          <WatchlistAIChatPanel
            stock={detail.stock}
            currentPrice={detail.currentPrice}
            sentiment={detail.sentiment}
            metrics={detail.metrics}
          />
        )}
      </div>
    </div>
  );
}
