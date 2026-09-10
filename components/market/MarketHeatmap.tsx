"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

export function MarketHeatmap() {
  const [activeGroup, setActiveGroup] = useState(MARKET_HEATMAP_GROUPS[0].id);
  const [stocks, setStocks] = useState<HeatmapStock[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError(null);
    fetch(`/api/market-heatmap?group=${encodeURIComponent(activeGroup)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { stocks?: HeatmapStock[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load heatmap.");
        setStocks(payload.stocks ?? []);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load heatmap.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeGroup]);

  const selected = MARKET_HEATMAP_GROUPS.find((group) => group.id === activeGroup) ?? MARKET_HEATMAP_GROUPS[0];
  const rectangles = useMemo(() => makeTreemap(stocks, { x: 0, y: 0, width: size.width, height: size.height }), [size, stocks]);

  return (
    <section aria-labelledby="market-heatmap-title">
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

      <div ref={areaRef} className="relative mt-5 h-[560px] overflow-hidden rounded-2xl border border-border-subtle bg-black" role="tabpanel" aria-live="polite">
        {!loading && !error && <HeatCanvas stocks={stocks} rectangles={rectangles} width={size.width} height={size.height} />}
        <div className="absolute inset-0">
          {stocks.map((stock) => {
            const rect = rectangles.get(stock.symbol);
            if (!rect) return null;
            const gap = 5;
            const compact = rect.width < 130 || rect.height < 94;
            return (
              <Link key={stock.symbol} href={`/stock/${encodeURIComponent(stock.symbol)}`} className="absolute flex flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-black/15 p-3 transition-all duration-200 hover:z-10 hover:bg-black/30 hover:ring-1 hover:ring-white/50" style={{ left: rect.x + gap, top: rect.y + gap, width: Math.max(0, rect.width - gap * 2), height: Math.max(0, rect.height - gap * 2) }} aria-label={`${stock.name} (${stock.symbol}), ${formatPercent(stock.changePercent)}`}>
                <span className={cn("font-bold tracking-tight text-white", compact ? "text-base" : "text-2xl")}>{stock.symbol}</span>
                {!compact && <span className="truncate text-sm text-white/70">{stock.name}</span>}
                <span className={cn("font-semibold", compact ? "text-sm" : "text-lg", (stock.changePercent ?? 0) >= 0 ? "text-[#adfa1b]" : "text-[#ff7560]")}>{formatPercent(stock.changePercent)}</span>
                {!compact && <span className="text-sm text-white/75">{formatCurrency(stock.price)}</span>}
              </Link>
            );
          })}
        </div>
        {loading && <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">Loading {selected.label.toLowerCase()} market map…</div>}
        {error && <div className="absolute inset-0 flex items-center justify-center text-sm text-negative">{error}</div>}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-text-muted"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-negative" />Below −1%</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-panel-muted" />Near flat</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-positive" />Above +1%</span></div>
    </section>
  );
}
