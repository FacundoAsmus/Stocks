"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { DEFAULT_WATCHLIST } from "@/lib/constants";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/types/stock";
import { DesktopStockDetail } from "@/components/DesktopStockDetail";
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
// the phone watchlist.
function WatchlistListRow({
  stock,
  isSelected,
  isDragOver,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: {
  stock: StockSummary;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b border-border-subtle/70 px-4 py-3.5 transition-colors last:border-0",
        isSelected ? "bg-panel-muted" : "hover:bg-panel-muted/50",
        isDragOver ? "ring-2 ring-positive/60" : ""
      )}
    >
      {stock.logo ? (
        <img
          src={stock.logo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md border border-white/10 bg-white/5 object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary",
          stock.logo && "hidden"
        )}
      >
        {stock.symbol.replace("^", "").slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-text-primary">{stock.symbol}</span>
      </span>
      <RowSparkline stock={stock} />
      <span className="ml-1 shrink-0">
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
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

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

  const symbolQuery = useMemo(() => symbols.join(","), [symbols]);

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

  // ── Drag to reorder (same behavior as components/Watchlist.tsx, adapted to a vertical list) ──
  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndexRef.current === null || dragIndexRef.current === index) {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      return;
    }
    const newStocks = [...displayedStocks];
    [newStocks[dragIndexRef.current], newStocks[index]] = [newStocks[index], newStocks[dragIndexRef.current]];
    setDisplayedStocks(newStocks);
    const newSymbols = newStocks.map((s) => s.symbol);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newSymbols));
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  if (isListLoading) return <EmptyWatchlist isLoading />;
  if (listError) return <ErrorState title="Watchlist unavailable" message={listError} />;
  if (!displayedStocks.length) return <EmptyWatchlist />;

  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-border-subtle/70"
      style={{ height: "calc(100dvh - var(--header-height, 0px) - 13rem)", minHeight: 480 }}
    >
      {/* Left: 1/3 — list of stocks, styled like the phone watchlist rows */}
      <div className="w-1/3 shrink-0 overflow-y-auto border-r border-border-subtle/70 bg-black">
        {displayedStocks.map((stock, index) => (
          <WatchlistListRow
            key={stock.symbol}
            stock={stock}
            isSelected={stock.symbol === selectedSymbol}
            isDragOver={dragOverIndex === index}
            onSelect={() => setSelectedSymbol(stock.symbol)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              handleDragStart(index);
            }}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Right: 2/3 — the individual stock page for whichever row is selected.
          Loads in place via /api/stock-detail; no full page reload. */}
      <div ref={detailPanelRef} className="relative w-2/3 overflow-y-auto">
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
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
