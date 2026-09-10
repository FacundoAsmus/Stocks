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
  const intensity = Math.min(1, Math.abs(change ?? 0) / 1.5);
  if ((change ?? 0) > 0.08) return [0, Math.round(92 + intensity * 108), 5];
  if ((change ?? 0) < -0.08) return [Math.round(120 + intensity * 135), Math.round(42 - intensity * 18), 3];
  return [46, 50, 54];
}

function mix(from: number, to: number, progress: number) {
  return Math.round(from + (to - from) * progress);
}

function drawGlow(
  context: CanvasRenderingContext2D,
  rect: Rectangle,
  color: [number, number, number],
  opacity: number,
) {
  const radius = Math.max(rect.width, rect.height) * 0.92;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  const [r, g, b] = color;
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.85 * opacity})`);
  gradient.addColorStop(0.48, `rgba(${r}, ${g}, ${b}, ${0.42 * opacity})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(rect.x - radius, rect.y - radius, rect.width + radius * 2, rect.height + radius * 2);
}

function HeatCanvas({
  stocks,
  rectangles,
  previousStocks,
  previousRectangles,
  isLoading,
  width,
  height,
}: {
  stocks: HeatmapStock[];
  rectangles: Map<string, Rectangle>;
  previousStocks: HeatmapStock[] | null;
  previousRectangles: Map<string, Rectangle> | null;
  isLoading: boolean;
  width: number;
  height: number;
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
    const shouldTransition = Boolean(previousStocks && !isLoading);
    const priorBySymbol = new Map<string, HeatmapStock>(shouldTransition ? previousStocks?.map((stock) => [stock.symbol, stock] as const) ?? [] : []);
    const currentBySymbol = new Map<string, HeatmapStock>(stocks.map((stock) => [stock.symbol, stock] as const));
    const symbols = [...new Set([...priorBySymbol.keys(), ...currentBySymbol.keys()])];
    const startedAt = performance.now();
    const duration = shouldTransition ? 950 : 0;
    let frame = 0;

    const paint = (now: number) => {
      const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
      // While the request is in flight the existing colour field stays in
      // place and only breathes slightly. It is not replaced by a preset map.
      const drift = isLoading || progress >= 1 ? Math.sin(now / 1800) * 3 : 0;
      context.fillStyle = "#060708";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      for (const symbol of symbols) {
        const before = priorBySymbol.get(symbol);
        const after = currentBySymbol.get(symbol);
        const fromRect = previousRectangles?.get(symbol);
        const toRect = rectangles.get(symbol);
        const start = fromRect ?? toRect;
        const end = toRect ?? fromRect;
        if (!start || !end) continue;
        const beforeColor = colorForChange(before?.changePercent ?? after?.changePercent ?? null);
        const afterColor = colorForChange(after?.changePercent ?? before?.changePercent ?? null);
        const rect = {
          x: start.x + (end.x - start.x) * progress + drift,
          y: start.y + (end.y - start.y) * progress - drift,
          width: start.width + (end.width - start.width) * progress,
          height: start.height + (end.height - start.height) * progress,
        };
        drawGlow(context, rect, [mix(beforeColor[0], afterColor[0], progress), mix(beforeColor[1], afterColor[1], progress), mix(beforeColor[2], afterColor[2], progress)], before && after ? 1 : before ? 1 - progress : progress);
      }
      context.globalCompositeOperation = "source-over";
      if (isLoading || !duration || progress < 1) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [height, isLoading, previousRectangles, previousStocks, rectangles, stocks, width]);
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
  const [previousStocks, setPreviousStocks] = useState<HeatmapStock[] | null>(null);
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
        // Tiles only fade; the colour field underneath performs the fluid move.
        revealTimer = window.setTimeout(() => setTilesVisible(true), 220);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load heatmap.");
      })
      .finally(() => { if (!controller.signal.aborted && !revealTimer) setLoading(false); });
    return () => {
      controller.abort();
      if (revealTimer) window.clearTimeout(revealTimer);
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

      <div ref={areaRef} className="relative mx-4 mt-4 min-h-[calc(100dvh-12rem)] flex-1 overflow-hidden rounded-t-2xl border border-white/10 bg-black" role="tabpanel" aria-live="polite">
        {loading && !stocks.length && <LoadingHeatCanvas group={activeGroup} width={size.width} height={size.height} />}
        {!!stocks.length && !error && <HeatCanvas stocks={stocks} rectangles={rectangles} previousStocks={previousStocks} previousRectangles={previousRectangles} isLoading={loading} width={size.width} height={size.height} />}
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
      <div className="mx-4 min-h-24 shrink-0 py-4" aria-label="Sector fund">
        {selected.sectorFund && (
          <Link
            href={`/stock/${encodeURIComponent(selected.sectorFund.symbol)}`}
            className="flex min-h-16 items-center justify-between rounded-b-2xl border border-white/10 bg-panel-muted/70 px-5 transition-colors hover:border-accent/50 hover:bg-panel-muted"
          >
            <span>
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Sector fund</span>
              <span className="mt-1 block text-sm text-text-primary">{selected.sectorFund.name}</span>
            </span>
            <span className="text-lg font-bold text-accent">{selected.sectorFund.symbol}</span>
          </Link>
        )}
      </div>
      <style>{`@media (prefers-reduced-motion: reduce) { .heatmap-tile { transition: none !important; } }`}</style>
    </section>
  );
}
