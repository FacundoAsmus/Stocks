"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { MARKET_HEATMAP_GROUPS } from "@/lib/marketHeatmap";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

type HeatmapStock = {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  weight: number;
};

type Rectangle = { x: number; y: number; width: number; height: number };

function makeTreemap(items: HeatmapStock[], bounds: Rectangle): Map<string, Rectangle> {
  const output = new Map<string, Rectangle>();
  const place = (group: HeatmapStock[], box: Rectangle) => {
    if (!group.length) return;
    if (group.length === 1) { output.set(group[0].symbol, box); return; }

    const total = group.reduce((sum, item) => sum + Math.max(item.weight, 1), 0);
    let splitAt = 1;
    let leftWeight = Math.max(group[0].weight, 1);
    while (splitAt < group.length - 1 && leftWeight < total / 2) {
      leftWeight += Math.max(group[splitAt].weight, 1);
      splitAt += 1;
    }
    const ratio = Math.min(0.8, Math.max(0.2, leftWeight / total));
    const first = group.slice(0, splitAt);
    const second = group.slice(splitAt);
    if (box.width >= box.height) {
      const width = box.width * ratio;
      place(first, { x: box.x, y: box.y, width, height: box.height });
      place(second, { x: box.x + width, y: box.y, width: box.width - width, height: box.height });
    } else {
      const height = box.height * ratio;
      place(first, { x: box.x, y: box.y, width: box.width, height });
      place(second, { x: box.x, y: box.y + height, width: box.width, height: box.height - height });
    }
  };
  place([...items].sort((a, b) => b.weight - a.weight), bounds);
  return output;
}

function colorForChange(change: number | null): [number, number, number] {
  // Every tile uses the same continuous scale. ±5% reaches the saturated
  // endpoint, while smaller moves blend smoothly through the neutral yellow.
  const value = change ?? 0;
  const amount = Math.min(1, Math.abs(value) / 5);
  const neutral: [number, number, number] = [153, 126, 38];
  const endpoint: [number, number, number] = value < 0 ? [159, 44, 44] : [21, 125, 67];
  return [
    Math.round(neutral[0] + (endpoint[0] - neutral[0]) * amount),
    Math.round(neutral[1] + (endpoint[1] - neutral[1]) * amount),
    Math.round(neutral[2] + (endpoint[2] - neutral[2]) * amount),
  ];
}

function drawTileFill(
  context: CanvasRenderingContext2D,
  rect: Rectangle,
  color: [number, number, number],
) {
  const [r, g, b] = color;
  // Flat fill is intentionally independent of rectangle size. The small
  // alpha overlay only softens tile edges; it is not a radial light source.
  context.fillStyle = `rgb(${r}, ${g}, ${b})`;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  const edge = context.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  edge.addColorStop(0, "rgba(0, 0, 0, 0.10)");
  edge.addColorStop(0.14, "rgba(0, 0, 0, 0)");
  edge.addColorStop(0.86, "rgba(0, 0, 0, 0)");
  edge.addColorStop(1, "rgba(0, 0, 0, 0.12)");
  context.fillStyle = edge;
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function HeatCanvas({
  stocks,
  rectangles,
  width,
  height,
  className,
}: {
  stocks: HeatmapStock[];
  rectangles: Map<string, Rectangle>;
  width: number;
  height: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const stock of stocks) {
      const rect = rectangles.get(stock.symbol);
      if (rect) drawTileFill(context, rect, colorForChange(stock.changePercent));
    }
  }, [height, rectangles, stocks, width]);
  return <canvas ref={ref} className={cn("absolute inset-0 h-full w-full", className)} aria-hidden="true" />;
}

function LoadingHeatCanvas({ group, width, height }: { group: string; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const seed = [...group].reduce((total, char) => total + char.charCodeAt(0), 0);
    let frame = 0;
    const paint = (now: number) => {
      const time = now / 1000;
      context.fillStyle = "#060708";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      for (let index = 0; index < 9; index += 1) {
        const angle = time * (0.34 + (index % 3) * 0.05) + index * 1.7 + seed * 0.01;
        const x = width * (0.5 + Math.cos(angle) * (0.22 + (index % 2) * 0.08));
        const y = height * (0.5 + Math.sin(angle * 1.21) * (0.25 + (index % 3) * 0.05));
        const radius = Math.max(width, height) * (0.27 + (index % 3) * 0.035);
        const green = (index + seed) % 2 === 0;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, green ? "rgba(173, 250, 27, 0.5)" : "rgba(255, 48, 3, 0.48)");
        gradient.addColorStop(0.55, green ? "rgba(0, 200, 5, 0.18)" : "rgba(255, 48, 3, 0.17)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      context.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [group, height, width]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export function MarketHeatmap() {
  const [activeGroup, setActiveGroup] = useState(MARKET_HEATMAP_GROUPS[0].id);
  const [stocks, setStocks] = useState<HeatmapStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousStocks, setPreviousStocks] = useState<HeatmapStock[] | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tilesVisible, setTilesVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let revealTimer: number | undefined;
    let transitionTimer: number | undefined;
    setLoading(true);
    setTilesVisible(false);
    setError(null);
    fetch(`/api/market-heatmap?group=${encodeURIComponent(activeGroup)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { stocks?: HeatmapStock[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load heatmap.");
        setPreviousStocks(stocks.length ? stocks : null);
        setStocks(payload.stocks ?? []);
        setLoading(false);
        setIsTransitioning(stocks.length > 0);
        revealTimer = window.setTimeout(() => setTilesVisible(true), 180);
        transitionTimer = window.setTimeout(() => {
          setPreviousStocks(null);
          setIsTransitioning(false);
        }, 1200);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load heatmap.");
      })
      .finally(() => { if (!controller.signal.aborted && !revealTimer) setLoading(false); });
    return () => {
      controller.abort();
      if (revealTimer) window.clearTimeout(revealTimer);
      if (transitionTimer) window.clearTimeout(transitionTimer);
    };
  // `stocks` deliberately is not a dependency: it is the exact visual state
  // held in place while the next section is being requested.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  const selected = MARKET_HEATMAP_GROUPS.find((group) => group.id === activeGroup) ?? MARKET_HEATMAP_GROUPS[0];
  const rectangles = useMemo(() => makeTreemap(stocks, { x: 0, y: 0, width: size.width, height: size.height }), [size, stocks]);
  const previousRectangles = useMemo(() => previousStocks ? makeTreemap(previousStocks, { x: 0, y: 0, width: size.width, height: size.height }) : null, [previousStocks, size]);

  return (
    <section className="flex min-h-dvh flex-col overflow-hidden bg-black" aria-labelledby="market-heatmap-title">
      {/* This is a real layout row, rather than an overlay: the map always
          starts below the title and section buttons. */}
      <div className="relative z-20 shrink-0 border-b border-white/10 bg-black px-6 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Market map</p>
            <h2 id="market-heatmap-title" className="mt-1 text-3xl font-semibold text-text-primary">{selected.label}</h2>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Market groups">
        {MARKET_HEATMAP_GROUPS.map((group) => (
          <button key={group.id} type="button" role="tab" aria-selected={group.id === activeGroup} onClick={() => setActiveGroup(group.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", group.id === activeGroup ? "border-accent bg-accent text-black" : "border-border-subtle text-text-muted hover:border-accent/50 hover:text-text-primary")}>{group.label}</button>
        ))}
        </div>
      </div>

      <div ref={areaRef} className="relative mx-4 mt-4 min-h-[calc(100dvh-12rem)] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black" role="tabpanel" aria-live="polite">
        {loading && !stocks.length && <LoadingHeatCanvas group={activeGroup} width={size.width} height={size.height} />}
        {!!previousStocks?.length && isTransitioning && previousRectangles && <HeatCanvas stocks={previousStocks} rectangles={previousRectangles} width={size.width} height={size.height} className="heatmap-fade-out" />}
        {!!stocks.length && !error && <HeatCanvas key={activeGroup} stocks={stocks} rectangles={rectangles} width={size.width} height={size.height} className={isTransitioning ? "heatmap-fade-in" : undefined} />}
        {!loading && !error && <div className="absolute inset-0">
          {stocks.map((stock) => {
            const rect = rectangles.get(stock.symbol);
            if (!rect) return null;
            const gap = 5;
            const compact = rect.width < 130 || rect.height < 94;
            const tileStyle: CSSProperties = {
              left: rect.x + gap,
              top: rect.y + gap,
              width: Math.max(0, rect.width - gap * 2),
              height: Math.max(0, rect.height - gap * 2),
              opacity: tilesVisible ? 1 : 0,
            };
            return (
              <Link key={stock.symbol} href={`/stock/${encodeURIComponent(stock.symbol)}`} className="heatmap-tile absolute flex flex-col overflow-hidden rounded-lg border border-white/10 bg-black/15 p-3 transition-opacity duration-200 hover:z-10 hover:bg-black/30 hover:ring-1 hover:ring-white/50" style={tileStyle} aria-label={`${stock.name} (${stock.symbol}), ${formatPercent(stock.changePercent)}`}>
                <span className={cn("font-bold tracking-tight text-white", compact ? "text-base" : "text-2xl")}>{stock.symbol}</span>
                <span className={cn("mt-1 truncate text-white/70", compact ? "text-xs" : "text-sm")}>{stock.name}</span>
                <span className={cn("mt-auto font-semibold", compact ? "text-sm" : "text-lg", (stock.changePercent ?? 0) >= 0 ? "text-[#adfa1b]" : "text-[#ff7560]")}>{formatPercent(stock.changePercent)}</span>
              </Link>
            );
          })}
        </div>}
        {error && <div className="absolute inset-0 flex items-center justify-center text-sm text-negative">{error}</div>}
      </div>
      <div className="mx-4 min-h-40 shrink-0 py-4 pb-20" aria-label="Sector fund">
        {selected.sectorFund && (
          <Link
            href={`/stock/${encodeURIComponent(selected.sectorFund.symbol)}`}
            className="flex min-h-16 items-center justify-between rounded-2xl border border-white/10 bg-panel-muted/70 px-5 transition-colors hover:border-accent/50 hover:bg-panel-muted"
          >
            <span>
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Sector fund</span>
              <span className="mt-1 block text-sm text-text-primary">{selected.sectorFund.name}</span>
            </span>
            <span className="text-lg font-bold text-accent">{selected.sectorFund.symbol}</span>
          </Link>
        )}
      </div>
      <style>{`@keyframes heatmap-fade-out { from { opacity: 1; } to { opacity: 0; } } @keyframes heatmap-fade-in { from { opacity: 0; } to { opacity: 1; } } .heatmap-fade-out, .heatmap-fade-in { animation: 1200ms cubic-bezier(.4, 0, .2, 1) both; } .heatmap-fade-out { animation-name: heatmap-fade-out; } .heatmap-fade-in { animation-name: heatmap-fade-in; } @media (prefers-reduced-motion: reduce) { .heatmap-tile, .heatmap-fade-out, .heatmap-fade-in { animation: none !important; transition: none !important; } }`}</style>
    </section>
  );
}
