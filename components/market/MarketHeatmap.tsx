"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { MARKET_HEATMAP_GROUPS } from "@/lib/marketHeatmap";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";

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
  const intensity = Math.min(1, Math.abs(change ?? 0) / 1.5);
  if ((change ?? 0) > 0.08) return [0, Math.round(92 + intensity * 108), 5];
  if ((change ?? 0) < -0.08) return [Math.round(120 + intensity * 135), Math.round(42 - intensity * 18), 3];
  return [46, 50, 54];
}

function HeatCanvas({ stocks, rectangles, width, height }: { stocks: HeatmapStock[]; rectangles: Map<string, Rectangle>; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = "#060708";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";

    for (const stock of stocks) {
      const rect = rectangles.get(stock.symbol);
      if (!rect) continue;
      const [r, g, b] = colorForChange(stock.changePercent);
      const radius = Math.max(rect.width, rect.height) * 0.92;
      const gradient = context.createRadialGradient(rect.x + rect.width / 2, rect.y + rect.height / 2, 0, rect.x + rect.width / 2, rect.y + rect.height / 2, radius);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
      gradient.addColorStop(0.48, `rgba(${r}, ${g}, ${b}, 0.42)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      context.fillStyle = gradient;
      context.fillRect(rect.x - radius, rect.y - radius, rect.width + radius * 2, rect.height + radius * 2);
    }
    context.globalCompositeOperation = "source-over";
  }, [height, rectangles, stocks, width]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
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
  const [settling, setSettling] = useState(false);
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
    let settleTimer: number | undefined;
    setLoading(true);
    setSettling(false);
    setError(null);
    fetch(`/api/market-heatmap?group=${encodeURIComponent(activeGroup)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { stocks?: HeatmapStock[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load heatmap.");
        setStocks(payload.stocks ?? []);
        setLoading(false);
        setSettling(true);
        settleTimer = window.setTimeout(() => setSettling(false), 720);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load heatmap.");
      })
      .finally(() => { if (!controller.signal.aborted && !settleTimer) setLoading(false); });
    return () => {
      controller.abort();
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, [activeGroup]);

  const selected = MARKET_HEATMAP_GROUPS.find((group) => group.id === activeGroup) ?? MARKET_HEATMAP_GROUPS[0];
  const rectangles = useMemo(() => makeTreemap(stocks, { x: 0, y: 0, width: size.width, height: size.height }), [size, stocks]);

  return (
    <section className="relative min-h-dvh overflow-hidden bg-black" aria-labelledby="market-heatmap-title">
      <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black via-black/90 to-transparent px-6 pb-14 pt-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Market map</p>
            <h2 id="market-heatmap-title" className="mt-1 text-3xl font-semibold text-text-primary">{selected.label}</h2>
          </div>
          <p className="text-sm text-text-muted">Tile size reflects {selected.staticWeights ? "relative fund size" : "market cap"} · colour reflects today’s move</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Market groups">
        {MARKET_HEATMAP_GROUPS.map((group) => (
          <button key={group.id} type="button" role="tab" aria-selected={group.id === activeGroup} onClick={() => setActiveGroup(group.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", group.id === activeGroup ? "border-accent bg-accent text-black" : "border-border-subtle text-text-muted hover:border-accent/50 hover:text-text-primary")}>{group.label}</button>
        ))}
        </div>
      </div>

      <div ref={areaRef} className="relative min-h-dvh overflow-hidden bg-black" role="tabpanel" aria-live="polite">
        {loading && <LoadingHeatCanvas group={activeGroup} width={size.width} height={size.height} />}
        {!loading && !error && <HeatCanvas stocks={stocks} rectangles={rectangles} width={size.width} height={size.height} />}
        {!loading && !error && <div className="absolute inset-0">
          {stocks.map((stock) => {
            const rect = rectangles.get(stock.symbol);
            if (!rect) return null;
            const gap = 5;
            const compact = rect.width < 130 || rect.height < 94;
            const tileStyle: CSSProperties & Record<"--from-x" | "--from-y", string> = {
              left: rect.x + gap,
              top: rect.y + gap,
              width: Math.max(0, rect.width - gap * 2),
              height: Math.max(0, rect.height - gap * 2),
              "--from-x": `${size.width / 2 - (rect.x + rect.width / 2)}px`,
              "--from-y": `${size.height / 2 - (rect.y + rect.height / 2)}px`,
              animation: settling ? "heatmap-tile-arrive 720ms cubic-bezier(0.22, 1, 0.36, 1) both" : undefined,
            };
            return (
              <Link key={stock.symbol} href={`/stock/${encodeURIComponent(stock.symbol)}`} className="heatmap-tile absolute flex flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-black/15 p-3 transition-all duration-200 hover:z-10 hover:bg-black/30 hover:ring-1 hover:ring-white/50" style={tileStyle} aria-label={`${stock.name} (${stock.symbol}), ${formatPercent(stock.changePercent)}`}>
                <span className={cn("font-bold tracking-tight text-white", compact ? "text-base" : "text-2xl")}>{stock.symbol}</span>
                {!compact && <span className="truncate text-sm text-white/70">{stock.name}</span>}
                <span className={cn("font-semibold", compact ? "text-sm" : "text-lg", (stock.changePercent ?? 0) >= 0 ? "text-[#adfa1b]" : "text-[#ff7560]")}>{formatPercent(stock.changePercent)}</span>
                {!compact && <span className="text-sm text-white/75">{formatCurrency(stock.price)}</span>}
              </Link>
            );
          })}
        </div>}
        {error && <div className="absolute inset-0 flex items-center justify-center text-sm text-negative">{error}</div>}
      </div>
      <style>{`@keyframes heatmap-tile-arrive { from { opacity: 0; transform: translate(var(--from-x), var(--from-y)) scale(0.16); } 55% { opacity: 0.92; } to { opacity: 1; transform: translate(0, 0) scale(1); } } @media (prefers-reduced-motion: reduce) { .heatmap-tile { animation: none !important; } }`}</style>
    </section>
  );
}
