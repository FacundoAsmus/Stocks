"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { DEFAULT_WATCHLIST } from "@/lib/constants";
import { SECTOR_ETFS } from "@/lib/etfs";
import { StockLogo } from "@/components/StockLogo";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/types/stock";
import { DesktopStockDetail } from "@/components/DesktopStockDetail";
import { StockAIChat } from "@/components/mobile/StockAIChat";
import { EmptyWatchlist } from "@/components/EmptyWatchlist";
import { ErrorState } from "@/components/ErrorState";
import type { getStockDetail } from "@/lib/finnhub";
import { WheelPrice } from "@/components/PriceChart";
import { subscribeToMarketRefresh } from "@/lib/marketRefresh";
import { revealSparklineOnDataChange } from "@/lib/sparklineReveal";
import { StockComparisonView, type ComparisonDetailPayload } from "@/components/desktop/StockComparisonView";

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
  const graphDataKey = `${stock.price ?? ""}:${data.map((point) => `${point.time}:${point.close}`).join("|")}`;
  const graphRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    revealSparklineOnDataChange(graphRef.current, stock.symbol, graphDataKey);
  }, [stock.symbol, graphDataKey]);
  return (
    <div ref={graphRef} className="h-10 w-20 shrink-0 pointer-events-none">
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
  isDragging,
  onSelect
}: {
  stock: StockSummary;
  isActive: boolean;
  isDragging: boolean;
  onSelect: () => void;
}) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const isEtf = SECTOR_ETFS.some((e) => e.symbol === stock.symbol);
  const hasStockLogo = !!stock.logo && !isEtf;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "desktop-alert-glass desktop-alert-glass-list-item flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-[filter,border-color,box-shadow] select-none",
        isDragging
          ? `is-lifted brightness-125 ${isActive ? "is-selected" : ""}`
          : isActive ? "is-selected brightness-105 hover:brightness-110" : "hover:brightness-110"
      )}
    >
      <StockLogo logo={hasStockLogo ? stock.logo : undefined} size={48}
        sizeClassName="h-9 w-9 shrink-0"
        imageClassName="h-9 w-9 shrink-0 rounded-3xl border border-white/10 bg-white/5 object-contain pointer-events-none"
        fallbackClassName="h-9 w-9 shrink-0 rounded-3xl object-contain pointer-events-none" />
      <span className="min-w-0 flex-1 pointer-events-none">
        <span className="block truncate text-sm font-bold text-text-primary">{stock.symbol}</span>
      </span>
      <div className="pointer-events-none">
        <RowSparkline stock={stock} />
      </div>
      <span className="ml-1 shrink-0 pointer-events-none">
        <span
          className={cn(
            "watchlist-change-badge inline-block rounded-3xl px-3 py-1 text-sm font-bold text-black",
            isPos ? "is-positive bg-positive" : "is-negative bg-negative"
          )}
        >
          <WheelPrice value={formatPercent(stock.changePercent)} size="badge" colorClass="text-black" compact />
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
          <div className="wl-w-1 h-3 w-0.5 rounded-full candle-loader-color-50" />
          <div className="wl-c-1 h-7 w-5 rounded-md candle-loader-color-50" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="wl-w-2 h-3.5 w-0.5 rounded-full candle-loader-color-70" />
          <div className="wl-c-2 h-11 w-5 rounded-md candle-loader-color-70" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="wl-w-3 h-4 w-0.5 rounded-full candle-loader-color-100" />
          <div className="wl-c-3 h-14 w-5 rounded-md candle-loader-color-100" />
        </div>
      </div>
      <span className="text-sm font-medium text-text-muted">{label}</span>
    </div>
  );
}

function DesktopWatchlistSkeleton() {
  return (
    <div className="watchlist-desktop-root flex w-full" style={{ height: "calc(100dvh - var(--header-height, 0px))" }} aria-label="Loading watchlist" role="status">
      <div className="desktop-alert-glass desktop-list-holder m-3 flex w-[23%] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/15">
        <div className="shrink-0 px-6 pb-4 pt-6">
          <div className="mb-3 h-3 w-20 animate-pulse rounded-full bg-panel-muted" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-panel-muted" />
        </div>
        <div className="flex-1 space-y-3 overflow-hidden px-3 pb-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl border-2 border-transparent px-4 py-3.5">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-3xl bg-panel-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-16 animate-pulse rounded-full bg-panel-muted" />
                <div className="h-2 w-24 animate-pulse rounded-full bg-panel-muted/70" />
              </div>
              <div className="h-8 w-16 shrink-0 animate-pulse rounded-md bg-panel-muted/80" />
              <div className="h-7 w-14 shrink-0 animate-pulse rounded-lg bg-panel-muted" />
            </div>
          ))}
        </div>
      </div>
      <div className="relative h-full min-w-0 w-3/4 overflow-hidden">
        <div className="animate-pulse px-6 pt-3 pb-8">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="h-3 w-28 rounded-full bg-panel-muted" />
              <div className="h-9 w-52 rounded-lg bg-panel-muted" />
              <div className="h-4 w-36 rounded-full bg-panel-muted/70" />
            </div>
            <div className="h-10 w-10 rounded-full bg-panel-muted" />
          </div>
          <div className="mb-8 flex items-end gap-4">
            <div className="h-12 w-44 rounded-lg bg-panel-muted" />
            <div className="mb-1 h-6 w-24 rounded-lg bg-panel-muted/70" />
          </div>
          <div className="mb-6 h-[384px] w-full rounded-2xl border border-border-subtle/50 bg-panel/40 p-8">
            <div className="flex h-full items-end gap-2 opacity-60">
              {[36, 52, 44, 68, 57, 76, 62, 88, 70, 96, 82, 100, 74, 90, 66, 84, 72, 98, 80, 92].map((height, index) => (
                <div key={index} className="flex-1 animate-pulse rounded-t-sm bg-accent/20" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl border border-border-subtle/50 bg-panel/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WatchlistSplitView() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [watchlistReady, setWatchlistReady] = useState(false);
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [displayedStocks, setDisplayedStocks] = useState<StockSummary[]>([]);
  const [removingSymbols, setRemovingSymbols] = useState<Set<string>>(() => new Set());
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [comparisonSymbol, setComparisonSymbol] = useState<string | null>(null);
  const [comparisonDetail, setComparisonDetail] = useState<ComparisonDetailPayload | null>(null);
  const [isComparisonLoading, setIsComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
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
  // Which row (by symbol) is currently being dragged, if any — used purely
  // to force a solid background on that row (see WatchlistListRow) so it
  // never looks transparent while it's lifted above its neighbors.
  const [draggingSymbol, setDraggingSymbol] = useState<string | null>(null);
  // Reorder.Group's onReorder fires continuously WHILE dragging (every time
  // the dragged row crosses another row), not just once on drop. We keep the
  // list visually reordered live via displayedStocks, but only persist to
  // localStorage / notify other components once the drag actually ends —
  // otherwise every mid-drag step round-trips through the
  // "watchlist-updated" listener below, resets `symbols`, and (because the
  // fetch used to key off symbol *order*) re-triggers the full watchlist
  // fetch/loading screen mid-drag, which looked like the page reloading.
  const pendingOrderRef = useRef<string[] | null>(null);
  const symbolsRef = useRef<string[]>([]);
  const pendingSymbolsRef = useRef<string[] | null>(null);
  const removalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedListRef = useRef(false);

  // ── Load watchlist symbols + summaries (same approach as components/Watchlist.tsx) ──
  useEffect(() => {
    const initialSymbols = readWatchlist();
    symbolsRef.current = initialSymbols;
    setSymbols(initialSymbols);
    setWatchlistReady(true);
    function handleStorage() {
      const nextSymbols = readWatchlist();
      const pending = pendingSymbolsRef.current;
      if (pending && pending.length === nextSymbols.length && pending.every((symbol, index) => symbol === nextSymbols[index])) return;
      const previousSymbols = pending ?? symbolsRef.current;
      const removedSymbols = previousSymbols.filter(symbol => !nextSymbols.includes(symbol));
      if (removedSymbols.length) {
        pendingSymbolsRef.current = nextSymbols;
        setRemovingSymbols(current => new Set([...current, ...removedSymbols]));
        if (removalTimerRef.current) clearTimeout(removalTimerRef.current);
        removalTimerRef.current = setTimeout(() => {
          const finalSymbols = readWatchlist();
          symbolsRef.current = finalSymbols;
          pendingSymbolsRef.current = null;
          setSymbols(finalSymbols);
          setDisplayedStocks(current => current.filter(stock => finalSymbols.includes(stock.symbol)));
          setRemovingSymbols(new Set());
          removalTimerRef.current = null;
        }, 500);
        return;
      }
      symbolsRef.current = nextSymbols;
      pendingSymbolsRef.current = null;
      setSymbols(nextSymbols);
    }
    window.addEventListener("watchlist-updated", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      if (removalTimerRef.current) clearTimeout(removalTimerRef.current);
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
      if (symbol) {
        setComparisonSymbol(null);
        setComparisonDetail(null);
        setSelectedSymbol(symbol);
      }
    }
    window.addEventListener("watchlist-preview-symbol", handlePreview);
    return () => window.removeEventListener("watchlist-preview-symbol", handlePreview);
  }, []);

  useEffect(() => {
    function handleCompare(e: Event) {
      const nextSymbol = (e as CustomEvent<string>).detail?.trim().toUpperCase();
      if (!nextSymbol || !selectedSymbol || nextSymbol === selectedSymbol.toUpperCase()) return;
      setComparisonDetail(null);
      setComparisonError(null);
      setComparisonSymbol(nextSymbol);
    }
    window.addEventListener("watchlist-compare-symbol", handleCompare);
    return () => window.removeEventListener("watchlist-compare-symbol", handleCompare);
  }, [selectedSymbol]);

  const symbolQuery = useMemo(() => [...symbols].sort().join(","), [symbols]);

  useEffect(() => {
    if (!watchlistReady) return;
    const controller = new AbortController();
    async function loadStocks() {
      if (!symbolQuery) {
        setStocks([]);
        hasLoadedListRef.current = true;
        setIsListLoading(false);
        return;
      }
      setIsListLoading(true);
      setListError(null);
      try {
        const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbolQuery)}&refresh=1`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const data = (await response.json()) as { stocks?: StockSummary[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load watchlist.");
        const nextStocks = data.stocks ?? [];
        setStocks(nextStocks);
        setDisplayedStocks(symbolsRef.current
          .map((sym) => nextStocks.find((stock) => stock.symbol === sym))
          .filter((stock): stock is StockSummary => !!stock));
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setListError(loadError instanceof Error ? loadError.message : "Unable to load watchlist.");
        }
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedListRef.current = true;
          setIsListLoading(false);
        }
      }
    }
    loadStocks();
    return () => controller.abort();
  }, [symbolQuery, watchlistReady]);

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
        const response = await fetch(`/api/stock-detail?symbol=${encodeURIComponent(selectedSymbol!)}&refresh=1`, {
          signal: controller.signal,
          cache: "no-store"
        });
        const data = (await response.json()) as DetailPayload & { error?: string };
        if (!response.ok) throw new Error(data.error ?? `Unable to load ${selectedSymbol}.`);
        setDetail(data);
        window.dispatchEvent(new CustomEvent("stock-data-refreshed", { detail: { symbol: selectedSymbol } }));
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

  useEffect(() => {
    if (!comparisonSymbol || comparisonSymbol === selectedSymbol) return;
    const controller = new AbortController();
    setIsComparisonLoading(true);
    setComparisonError(null);
    setComparisonDetail(null);
    async function loadComparison() {
      try {
        const response = await fetch(`/api/stock-detail?symbol=${encodeURIComponent(comparisonSymbol!)}&refresh=1`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json() as ComparisonDetailPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? `Unable to load ${comparisonSymbol}.`);
        if (!controller.signal.aborted) setComparisonDetail(payload);
      } catch (error) {
        if (!controller.signal.aborted) setComparisonError(error instanceof Error ? error.message : `Unable to load ${comparisonSymbol}.`);
      } finally {
        if (!controller.signal.aborted) setIsComparisonLoading(false);
      }
    }
    loadComparison();
    return () => controller.abort();
  }, [comparisonSymbol, selectedSymbol]);

  useEffect(() => {
    if (!watchlistReady) return;
    let listController: AbortController | null = null;
    let detailController: AbortController | null = null;
    const refresh = () => {
      if (symbolQuery) {
        listController?.abort();
        const requestController = new AbortController();
        listController = requestController;
        fetch(`/api/stocks?symbols=${encodeURIComponent(symbolQuery)}&refresh=1`, { signal: requestController.signal, cache: "no-store" })
          .then(async response => {
            const payload = await response.json() as { stocks?: StockSummary[] };
            if (!response.ok || requestController.signal.aborted || !payload.stocks) return;
            setStocks(payload.stocks);
            setDisplayedStocks(symbolsRef.current
              .map(symbol => payload.stocks?.find(stock => stock.symbol === symbol))
              .filter((stock): stock is StockSummary => !!stock));
          })
          .catch(() => undefined);
      }
      if (selectedSymbol) {
        detailController?.abort();
        const requestController = new AbortController();
        detailController = requestController;
        fetch(`/api/stock-detail?symbol=${encodeURIComponent(selectedSymbol)}&refresh=1`, { signal: requestController.signal, cache: "no-store" })
          .then(async response => {
            const payload = await response.json() as DetailPayload;
            if (!response.ok || requestController.signal.aborted) return;
            setDetail(payload);
            window.dispatchEvent(new CustomEvent("stock-data-refreshed", { detail: { symbol: selectedSymbol } }));
          })
          .catch(() => undefined);
      }
    };
    const unsubscribe = subscribeToMarketRefresh(refresh);
    return () => {
      unsubscribe();
      listController?.abort();
      detailController?.abort();
    };
  }, [watchlistReady, symbolQuery, selectedSymbol]);

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
    symbolsRef.current = finalOrder;
    setSymbols(finalOrder);
    writeWatchlist(finalOrder);
  }

  if (isListLoading && !hasLoadedListRef.current) return <DesktopWatchlistSkeleton />;
  if (listError && !displayedStocks.length) return <ErrorState title="Watchlist unavailable" message={listError} />;

  return (
    <div className="watchlist-desktop-root flex w-full" style={{ height: "calc(100dvh - var(--header-height, 0px))" }}>
      {/* Left: 1/4 — its own rounded, distinctly-shaded card holding the title + list.
          Background: #0e0e0e dark / #ffffff light (see .watchlist-list-panel in globals.css).
          Page background behind it: #ececec in light mode (.watchlist-desktop-root). */}
      <div className="desktop-alert-glass desktop-list-holder m-3 flex w-[23%] shrink-0 flex-col overflow-hidden rounded-3xl border border-white/15">
        <div className="shrink-0 px-6 pb-4 pt-6">
          <p className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">Your Stocks</p>
          <h1 className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Watchlist</h1>
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
              layout="position"
              initial={false}
              animate={removingSymbols.has(stock.symbol) ? { height: 0, opacity: 0, scale: 0.96, marginTop: 0, marginBottom: 0 } : { height: "auto", opacity: 1, scale: 1 }}
              transition={removingSymbols.has(stock.symbol) ? { duration: 0.48, ease: [0.22, 1, 0.36, 1] } : { type: "spring", stiffness: 500, damping: 40 }}
              className="mx-2 my-0.5 rounded-xl"
              // Keeping an explicit, persistent z-index tied to our own
              // `draggingSymbol` state (see below) — not just Framer's
              // `whileDrag`, which drops back to the default z-index the
              // instant the pointer is released. This item then keeps
              // playing a spring layout animation to settle into its new
              // slot for a little while after that, during which a sibling
              // that's also still mid-settle could otherwise render on top
              // of it (plain DOM stacking order, unrelated to which one you
              // were actually holding) — that's the "other element looks
              // like it's above" bug. Staying elevated until well after the
              // spring has settled (see the timeout in onDragEnd below)
              // fixes it.
              style={{ position: "relative", zIndex: stock.symbol === draggingSymbol ? 30 : 0, overflow: removingSymbols.has(stock.symbol) ? "hidden" : undefined }}
              whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }}
              onDragStart={() => setDraggingSymbol(stock.symbol)}
              onDragEnd={() => {
                justDraggedRef.current = true;
                commitReorder();
                // Keep this row's elevated z-index + solid background alive
                // until the settle animation above has had time to finish,
                // instead of dropping it the instant the pointer lifts.
                setTimeout(() => { setDraggingSymbol(null); }, 300);
                setTimeout(() => { justDraggedRef.current = false; }, 80);
              }}
            >
              <WatchlistListRow
                stock={stock}
                isActive={stock.symbol === selectedSymbol}
                isDragging={stock.symbol === draggingSymbol}
                onSelect={() => {
                  if (justDraggedRef.current) return;
                  setComparisonSymbol(null);
                  setComparisonDetail(null);
                  setSelectedSymbol(stock.symbol);
                }}
              />
            </Reorder.Item>
          ))}
          {!displayedStocks.length && (
            <div className="px-3 py-5">
              <EmptyWatchlist />
            </div>
          )}
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
          {comparisonSymbol ? (
            isDetailLoading || !detail ? (
              <PanelLoader label={`Loading ${selectedSymbol ?? "stock"} comparison`} />
            ) : isComparisonLoading ? (
              <PanelLoader label={`Loading ${comparisonSymbol} comparison data`} />
            ) : comparisonError ? (
              <div className="p-8">
                <ErrorState title={`Unable to compare ${comparisonSymbol}`} message={comparisonError} />
                <button type="button" className="mt-4 text-sm text-accent underline" onClick={() => { setComparisonSymbol(null); setComparisonDetail(null); }}>
                  Return to {selectedSymbol}
                </button>
              </div>
            ) : comparisonDetail ? (
              <StockComparisonView
                primary={detail}
                secondary={comparisonDetail}
                onRemovePrimary={() => {
                  setSelectedSymbol(comparisonDetail.stock.symbol);
                  setDetail(comparisonDetail);
                  setComparisonSymbol(null);
                  setComparisonDetail(null);
                }}
                onRemoveSecondary={() => {
                  setComparisonSymbol(null);
                  setComparisonDetail(null);
                }}
              />
            ) : null
          ) : isDetailLoading ? (
            <PanelLoader label={`Loading ${selectedSymbol ?? "stock"} data`} />
          ) : detailError ? (
            <div className="p-8">
              <ErrorState title={`Unable to load ${selectedSymbol}`} message={detailError} />
            </div>
          ) : detail ? (
            <div className="px-6 pt-3 pb-8">
              <DesktopStockDetail
                stock={detail.stock}
                currentPrice={detail.currentPrice}
                sentiment={detail.sentiment}
                metrics={detail.metrics}
                chartHeightClassName="h-[384px]"
                earningsCalendarContainerRef={detailColumnRef}
                hideCursorDateTooltip
                watchlistDetailHeader
              />
            </div>
          ) : !displayedStocks.length ? (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <div className="max-w-sm">
                <p className="text-lg font-semibold text-text-primary">Choose a stock to view its details</p>
                <p className="mt-2 text-sm text-text-muted">Search for a company above, then add it to your watchlist with the star button.</p>
              </div>
            </div>
          ) : null}
        </div>

        {detail && (!comparisonSymbol || comparisonDetail) && (
          <StockAIChat
            stock={detail.stock}
            currentPrice={detail.currentPrice}
            sentiment={detail.sentiment}
            metrics={detail.metrics}
            comparisonStock={comparisonSymbol && comparisonDetail ? comparisonDetail : undefined}
            containerRef={detailColumnRef}
          />
        )}
      </div>
    </div>
  );
}
