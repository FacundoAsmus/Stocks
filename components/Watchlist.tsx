"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { DEFAULT_WATCHLIST } from "@/lib/constants";
import type { StockSummary } from "@/types/stock";
import { EmptyWatchlist } from "./EmptyWatchlist";
import { ErrorState } from "./ErrorState";
import { StockCard } from "./StockCard";

const STORAGE_KEY = "market-lens-watchlist";

function readWatchlist() {
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

export function Watchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [displayedStocks, setDisplayedStocks] = useState<StockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const dragIndexRef = useRef<number | null>(null);
  const displayedSymbolsRef = useRef<string[]>([]);

  useEffect(() => {
    setSymbols(readWatchlist());
    function handleStorage() {
      const nextSymbols = readWatchlist();
      // Preserve the final card long enough for its exit animation; without
      // this, an empty-list render would unmount the grid before it can shrink.
      setIsRemoving(displayedSymbolsRef.current.some((symbol) => !nextSymbols.includes(symbol)));
      setSymbols(nextSymbols);
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
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbolQuery)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { stocks?: StockSummary[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load watchlist.");
        setStocks(data.stocks ?? []);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load watchlist.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    loadStocks();
    return () => controller.abort();
  }, [symbolQuery]);

  // Sort fetched stocks to match the saved symbol order
  useEffect(() => {
    const ordered = symbols
      .map((sym) => stocks.find((s) => s.symbol === sym))
      .filter((s): s is StockSummary => !!s);
    setDisplayedStocks(ordered);
  }, [stocks, symbols]);

  useEffect(() => {
    displayedSymbolsRef.current = displayedStocks.map((stock) => stock.symbol);
  }, [displayedStocks]);

  const sentimentColor = useMemo(() => {
    if (stocks.length === 0) return "transparent";
    const greenCount = stocks.filter((s) => (s.changePercent ?? 0) > 0).length;
    const redCount = stocks.filter((s) => (s.changePercent ?? 0) < 0).length;
    if (greenCount > redCount) return "rgba(34, 197, 94, 0.12)";
    if (redCount > greenCount) return "rgba(239, 68, 68, 0.12)";
    return "rgba(250, 204, 21, 0.12)";
  }, [stocks]);

  useEffect(() => {
  function onDragOver(e: DragEvent) {
    const threshold = 100;
    const speed = 10;
    if (e.clientY < threshold) window.scrollBy(0, -speed);
    else if (e.clientY > window.innerHeight - threshold) window.scrollBy(0, speed);
  }
  window.addEventListener("dragover", onDragOver);
  return () => window.removeEventListener("dragover", onDragOver);
}, []);

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

  // Do not replace an already rendered grid with a loading screen when a star
  // is toggled. Keeping these cards mounted lets AnimatePresence finish the
  // exit animation and prevents the page from appearing to reload.
  if (isLoading && !displayedStocks.length && !isRemoving) return <EmptyWatchlist isLoading />;
  if (error) return <ErrorState title="Watchlist unavailable" message={error} />;
  if (!displayedStocks.length && !isRemoving) return <EmptyWatchlist />;

  return (
    <div className="relative min-h-dvh">
      <div
        className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `linear-gradient(to top, ${sentimentColor} 0%, transparent 70%)`,
          pointerEvents: "none"
        }}
      />
      <div className="relative z-10 p-8">
        <section className="grid grid-cols-2 gap-3 px-2 sm:gap-6 sm:px-4 md:grid-cols-2 xl:grid-cols-3 justify-center items-stretch w-full auto-rows-fr">
                  <AnimatePresence initial={false} onExitComplete={() => setIsRemoving(false)}>
                    {displayedStocks.map((stock, index) => (
                    <motion.div
                      key={stock.symbol}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.92, y: 18 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88, y: -12 }}
                      transition={{
                        layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 0.26, ease: [0.16, 1, 0.3, 1] }
                      }}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; handleDragStart(index); }}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab active:cursor-grabbing transition-all duration-150 rounded-2xl sm:rounded-[32px] ${
                        dragOverIndex === index ? "ring-2 ring-positive/60" : ""
                      }`}
                    >
                      <StockCard stock={stock} />
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </section>
      </div>
    </div>
  );
}
