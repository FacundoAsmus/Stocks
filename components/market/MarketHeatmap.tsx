"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

import { MARKET_HEATMAP_GROUPS } from "@/lib/marketHeatmap";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import { DesktopStockDetail } from "@/components/DesktopStockDetail";
import { ErrorState } from "@/components/ErrorState";
import { MarketIcon } from "@/components/MarketIcon";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import type { getStockDetail } from "@/lib/finnhub";

type StockDetail = Awaited<ReturnType<typeof getStockDetail>>;
type DetailPayload = {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
};

type HeatmapStock = {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  weight: number;
};

type Rectangle = { x: number; y: number; width: number; height: number };

const BLEED_SIGMA = 0.08;
const NOISE_AMPLITUDE = 15;
const BRIGHTNESS_CURVE = 0.72;
const TRANSITION_MS = 900;
const MAX_HEAT_TILES = 150;



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
  const value = change ?? 0;
  const red: [number, number, number] = [238, 42, 21];
  const redOrange: [number, number, number] = [225, 80, 20];
  const orange: [number, number, number] = [235, 137, 18];
  const yellow: [number, number, number] = [215, 186, 22];
  const yellowGreen: [number, number, number] = [113, 188, 26];
  const green: [number, number, number] = [4, 202, 45];
  const blend = (from: [number, number, number], to: [number, number, number], progress: number): [number, number, number] => [
    Math.round(from[0] + (to[0] - from[0]) * progress),
    Math.round(from[1] + (to[1] - from[1]) * progress),
    Math.round(from[2] + (to[2] - from[2]) * progress),
  ];

  if (value <= -2) return red;
  if (value < -0.2) return blend(red, redOrange, (value + 2) / 1.8);
  if (value < 0) return orange;
  if (value <= 0.2) return yellow;
  if (value < 2) return blend(yellowGreen, green, (value - 0.2) / 1.8);
  return green;
}

function clampChange(change: number | null) {
  return Math.max(-3, Math.min(3, change ?? 0));
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createHeatProgram(gl: WebGL2RenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec2 position;
    out vec2 uv;
    void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
  `);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    precision highp int;
    in vec2 uv;
    out vec4 outColor;
    uniform sampler2D tileData;
    uniform sampler2D palette;
    uniform vec2 mapSize;
    uniform float sigma;
    uniform float noisePhase;
    uniform float noiseAmplitude;
    uniform float brightnessCurve;
    uniform int tileCount;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      vec2 pixel = vec2(uv.x, 1.0 - uv.y) * mapSize;
      vec2 noiseCoord = pixel / max(min(mapSize.x, mapSize.y) * 0.22, 1.0);
      vec2 warp = vec2(noise(noiseCoord + vec2(noisePhase, 0.0)), noise(noiseCoord + vec2(0.0, noisePhase + 17.0)))
                - vec2(noise(noiseCoord + vec2(noisePhase + 31.0, 19.0)), noise(noiseCoord + vec2(23.0, noisePhase + 47.0)));
      pixel += warp * noiseAmplitude;
      float weightedValue = 0.0;
      float totalWeight = 0.0;
      for (int i = 0; i < ${MAX_HEAT_TILES}; i++) {
        if (i >= tileCount) break;
        vec4 packed = texelFetch(tileData, ivec2(i, 0), 0);
        vec4 packedValue = texelFetch(tileData, ivec2(i, 1), 0);
        vec2 origin = packed.xy * mapSize;
        vec2 extent = packed.zw * mapSize;
        vec2 outside = max(max(origin - pixel, pixel - (origin + extent)), vec2(0.0));
        float distanceToTile = length(outside);
        float weight = exp(-pow(distanceToTile / max(sigma, 1.0), 2.0));
        float value = (packedValue.r * 6.0) - 3.0;
        weightedValue += weight * value;
        totalWeight += weight;
      }
      float value = clamp(weightedValue / max(totalWeight, 0.00001), -3.0, 3.0);
      float magnitude = pow(clamp(abs(value) / 3.0, 0.0, 1.0), brightnessCurve);
      vec3 color = texture(palette, vec2((value + 3.0) / 6.0, 0.5)).rgb;
      color *= 0.18 + 0.82 * magnitude;
      outColor = vec4(color, 1.0);
    }
  `);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createWebGLRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const program = createHeatProgram(gl);
  if (!program) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const buffer = gl.createBuffer();
  const tileTexture = gl.createTexture();
  const paletteTexture = gl.createTexture();
  if (!buffer || !tileTexture || !paletteTexture) {
    if (buffer) gl.deleteBuffer(buffer);
    if (tileTexture) gl.deleteTexture(tileTexture);
    if (paletteTexture) gl.deleteTexture(paletteTexture);
    gl.deleteProgram(program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const palette = new Uint8Array(256 * 4);
  for (let index = 0; index < 256; index += 1) {
    const [r, g, b] = colorForChange((index / 255) * 6 - 3);
    palette.set([r, g, b, 255], index * 4);
  }
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, palette);
  gl.uniform1i(gl.getUniformLocation(program, "palette"), 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tileTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, "tileData"), 0);

  return {
    render(stocks: HeatmapStock[], rectangles: Map<string, Rectangle>, width: number, height: number, phase: number) {
      const pixelWidth = Math.max(1, Math.round(width * (window.devicePixelRatio || 1) * 0.5));
      const pixelHeight = Math.max(1, Math.round(height * (window.devicePixelRatio || 1) * 0.5));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        gl.viewport(0, 0, pixelWidth, pixelHeight);
      }
      const count = Math.min(stocks.length, MAX_HEAT_TILES);
      const data = new Uint8Array(MAX_HEAT_TILES * 2 * 4);
      for (let index = 0; index < count; index += 1) {
        const rect = rectangles.get(stocks[index].symbol);
        if (!rect) continue;
        const offset = index * 4;
        data[offset] = Math.round(Math.max(0, Math.min(1, rect.x / width)) * 255);
        data[offset + 1] = Math.round(Math.max(0, Math.min(1, rect.y / height)) * 255);
        data[offset + 2] = Math.round(Math.max(0, Math.min(1, rect.width / width)) * 255);
        data[offset + 3] = Math.round(Math.max(0, Math.min(1, rect.height / height)) * 255);
        data[(MAX_HEAT_TILES + index) * 4] = Math.round(((clampChange(stocks[index].changePercent) + 3) / 6) * 255);
      }
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tileTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MAX_HEAT_TILES, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.uniform2f(gl.getUniformLocation(program, "mapSize"), width, height);
      gl.uniform1f(gl.getUniformLocation(program, "sigma"), Math.min(width, height) * BLEED_SIGMA);
      gl.uniform1f(gl.getUniformLocation(program, "noisePhase"), phase);
      gl.uniform1f(gl.getUniformLocation(program, "noiseAmplitude"), NOISE_AMPLITUDE);
      gl.uniform1f(gl.getUniformLocation(program, "brightnessCurve"), BRIGHTNESS_CURVE);
      gl.uniform1i(gl.getUniformLocation(program, "tileCount"), count);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(tileTexture);
      gl.deleteTexture(paletteTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

function drawFallback(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  stocks: HeatmapStock[],
  rectangles: Map<string, Rectangle>,
) {
  const scale = 1 / 8;
  const offscreen = document.createElement("canvas");
  offscreen.width = Math.max(1, Math.ceil(width * scale));
  offscreen.height = Math.max(1, Math.ceil(height * scale));
  const small = offscreen.getContext("2d");
  if (!small) return;
  small.fillStyle = "#342606";
  small.fillRect(0, 0, offscreen.width, offscreen.height);
  for (const stock of stocks) {
    const rect = rectangles.get(stock.symbol);
    if (!rect) continue;
    const [r, g, b] = colorForChange(stock.changePercent);
    small.fillStyle = `rgb(${r} ${g} ${b})`;
    small.fillRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
  }
  context.clearRect(0, 0, width, height);
  context.filter = `blur(${Math.max(1, Math.min(width, height) * BLEED_SIGMA * scale)}px)`;
  context.drawImage(offscreen, 0, 0, width, height);
  context.filter = "none";
  for (const stock of stocks) {
    const rect = rectangles.get(stock.symbol);
    if (!rect) continue;
    const [r, g, b] = colorForChange(stock.changePercent);
    context.globalAlpha = 0.2;
    context.fillStyle = `rgb(${r} ${g} ${b})`;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  context.globalAlpha = 1;
}

function drawGlow(context: CanvasRenderingContext2D, rect: Rectangle, color: [number, number, number]) {
  const radius = Math.max(rect.width, rect.height) * 0.92;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const [r, g, b] = color;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
  gradient.addColorStop(0.48, `rgba(${r}, ${g}, ${b}, 0.42)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(rect.x - radius, rect.y - radius, rect.width + radius * 2, rect.height + radius * 2);
}

function LegacyHeatCanvas({
  stocks, rectangles, width, height, className,
}: {
  stocks: HeatmapStock[]; rectangles: Map<string, Rectangle>; width: number; height: number; className?: string;
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
    context.globalCompositeOperation = "lighter";
    for (const stock of stocks) {
      const rect = rectangles.get(stock.symbol);
      if (rect) drawGlow(context, rect, colorForChange(stock.changePercent));
    }
    context.globalCompositeOperation = "source-over";
  }, [height, rectangles, stocks, width]);
  return <canvas ref={ref} className={cn("absolute inset-0 h-full w-full", className)} aria-hidden="true" />;
}

function HeatCanvas({
  stocks,
  rectangles,
  width,
  height,
  phase,
  className,
}: {
  stocks: HeatmapStock[];
  rectangles: Map<string, Rectangle>;
  width: number;
  height: number;
  phase?: number;
  className?: string;
}) {
  const webglRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createWebGLRenderer>>(null);
  const [useFallback, setUseFallback] = useState(false);
  useEffect(() => {
    const canvas = webglRef.current;
    if (!canvas) return;
    rendererRef.current = createWebGLRenderer(canvas);
    setUseFallback(!rendererRef.current);
    return () => { rendererRef.current?.dispose(); rendererRef.current = null; };
  }, []);
  useEffect(() => {
    if (!width || !height) return;
    if (rendererRef.current) rendererRef.current.render(stocks, rectangles, width, height, phase ?? 0);
    else if (useFallback) {
      const canvas = fallbackRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFallback(context, width, height, stocks, rectangles);
    }
  }, [height, phase, rectangles, stocks, useFallback, width]);
  return <>
    <canvas ref={webglRef} className={cn("absolute inset-0 h-full w-full", className, useFallback && "hidden")} aria-hidden="true" />
    <canvas ref={fallbackRef} className={cn("absolute inset-0 h-full w-full", className, !useFallback && "hidden")} aria-hidden="true" />
  </>;
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
      context.fillStyle = "#342606";
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

export function MarketHeatmap({ desktopLayout = false }: { desktopLayout?: boolean }) {
  const [activeGroup, setActiveGroup] = useState(MARKET_HEATMAP_GROUPS[0].id);
  const [stocks, setStocks] = useState<HeatmapStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [previousStocks, setPreviousStocks] = useState<HeatmapStock[] | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(1);
  const [tilesVisible, setTilesVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const detailColumnRef = useRef<HTMLDivElement>(null);
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
        const shouldAnimate = stocks.length > 0 && (!desktopLayout || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        setPreviousStocks(shouldAnimate ? stocks : null);
        setStocks(payload.stocks ?? []);
        setLoading(false);
        setIsTransitioning(shouldAnimate);
        if (desktopLayout) {
          setTransitionProgress(shouldAnimate ? 0 : 1);
          setTilesVisible(true);
        } else {
          revealTimer = window.setTimeout(() => setTilesVisible(true), 180);
          transitionTimer = window.setTimeout(() => {
            setPreviousStocks(null);
            setIsTransitioning(false);
          }, 1200);
        }
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
  }, [activeGroup, desktopLayout]);

  useEffect(() => {
    if (!desktopLayout || !isTransitioning || !previousStocks) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTransitionProgress(1);
      setPreviousStocks(null);
      setIsTransitioning(false);
      return;
    }
    let frame = 0;
    let elapsed = 0;
    let lastTime = 0;
    const animate = (now: number) => {
      if (document.hidden) {
        lastTime = 0;
        frame = requestAnimationFrame(animate);
        return;
      }
      if (!lastTime) lastTime = now;
      elapsed += Math.min(now - lastTime, 40);
      lastTime = now;
      const raw = Math.min(1, elapsed / TRANSITION_MS);
      setTransitionProgress(raw * raw * (3 - 2 * raw));
      if (raw < 1) frame = requestAnimationFrame(animate);
      else {
        setPreviousStocks(null);
        setIsTransitioning(false);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [desktopLayout, isTransitioning, previousStocks]);

  useEffect(() => {
    function handleMarketPreview(event: Event) {
      const symbol = (event as CustomEvent<string>).detail?.trim().toUpperCase();
      if (symbol) setSelectedSymbol(symbol);
    }
    window.addEventListener("market-preview-symbol", handleMarketPreview);
    return () => window.removeEventListener("market-preview-symbol", handleMarketPreview);
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    const symbol = selectedSymbol;
    const controller = new AbortController();
    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);
      detailColumnRef.current?.scrollTo({ top: 0 });
      try {
        const response = await fetch(`/api/stock-detail?symbol=${encodeURIComponent(symbol)}&refresh=1`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as DetailPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? `Unable to load ${symbol}.`);
        setDetail(payload);
      } catch (reason) {
        if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : `Unable to load ${symbol}.`);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => controller.abort();
  }, [selectedSymbol]);

  const selected = MARKET_HEATMAP_GROUPS.find((group) => group.id === activeGroup) ?? MARKET_HEATMAP_GROUPS[0];
  const rectangles = useMemo(() => makeTreemap(stocks, { x: 0, y: 0, width: size.width, height: size.height }), [size, stocks]);
  const previousRectangles = useMemo(() => previousStocks ? makeTreemap(previousStocks, { x: 0, y: 0, width: size.width, height: size.height }) : null, [previousStocks, size]);
  const heatStocks = useMemo(() => {
    if (!desktopLayout || !previousStocks || !previousRectangles || !isTransitioning) return stocks;
    const oldBySymbol = new Map(previousStocks.map((stock) => [stock.symbol, stock]));
    const newBySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));
    const symbols = [...new Set([...oldBySymbol.keys(), ...newBySymbol.keys()])];
    return symbols.map((symbol) => {
      const oldStock = oldBySymbol.get(symbol);
      const newStock = newBySymbol.get(symbol);
      const base = newStock ?? oldStock!;
      const oldValue = clampChange(oldStock?.changePercent ?? 0);
      const newValue = clampChange(newStock?.changePercent ?? 0);
      return { ...base, changePercent: oldValue + (newValue - oldValue) * transitionProgress };
    });
  }, [desktopLayout, isTransitioning, previousRectangles, previousStocks, stocks, transitionProgress]);
  const heatRectangles = useMemo(() => {
    if (!desktopLayout || !previousStocks || !previousRectangles || !isTransitioning) return rectangles;
    const result = new Map<string, Rectangle>();
    for (const stock of heatStocks) {
      const oldRect = previousRectangles.get(stock.symbol);
      const newRect = rectangles.get(stock.symbol);
      const source = oldRect ?? newRect!;
      const target = newRect ?? oldRect!;
      const from = oldRect ?? { x: target.x + target.width / 2, y: target.y + target.height / 2, width: 0, height: 0 };
      const to = newRect ?? { x: source.x + source.width / 2, y: source.y + source.height / 2, width: 0, height: 0 };
      const t = transitionProgress;
      result.set(stock.symbol, {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        width: from.width + (to.width - from.width) * t,
        height: from.height + (to.height - from.height) * t,
      });
    }
    return result;
  }, [desktopLayout, heatStocks, isTransitioning, previousRectangles, previousStocks, rectangles, transitionProgress]);

  return (
    <section
      className={cn("overflow-hidden bg-black", desktopLayout ? "flex h-[calc(100dvh-var(--header-height,0px))] min-h-0" : "flex h-[100dvh] min-h-0 flex-col")}
      aria-labelledby="market-heatmap-title"
    >
      {/* Desktop uses a watchlist-style selector rail; mobile gets a compact
          title bar followed by a horizontally swipeable group selector. */}
      {desktopLayout ? (
        <aside className="desktop-alert-glass desktop-list-holder m-3 flex w-1/6 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/15">
          <div className="shrink-0 px-6 pb-4 pt-6">
            <p className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">Heatmaps</p>
            <h2 id="market-heatmap-title" className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Market</h2>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-2" role="tablist" aria-label="Market groups" aria-orientation="vertical">
            {MARKET_HEATMAP_GROUPS.map((group) => {
              const isActive = !selectedSymbol && group.id === activeGroup;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { setSelectedSymbol(null); setDetail(null); setDetailError(null); setActiveGroup(group.id); }}
                  className={cn("desktop-alert-glass desktop-alert-glass-list-item market-heatmap-list-item mx-0.5 my-0.5 flex w-[calc(100%-0.25rem)] items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-[filter,border-color,transform,box-shadow] select-none hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0", isActive && "is-selected")}
                >
                  <OptionalSvgIcon name={group.id} selected={isActive} fallbackToBaseWhenSelected className={group.id === "semiconductors" ? "h-6 w-6" : "h-8 w-8"} colorClassName="text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-text-primary">{group.label}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{group.symbols.length} stocks</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      ) : (
      <>
        <div className="sticky top-0 z-30 shrink-0 px-4 pb-4" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10"
            style={{
              height: "calc(100% - 0.75rem)",
              backdropFilter: "blur(var(--phone-list-header-blur))",
              WebkitBackdropFilter: "blur(var(--phone-list-header-blur))",
              backgroundColor: "var(--color-background)",
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 id="market-heatmap-title" className="text-4xl font-bold text-text-primary">Heatmaps</h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-accent">Market</p>
            </div>
            <Image src="/icons/site-logo.png" alt="" width={80} height={40} className="h-10 w-20 shrink-0 object-contain" />
          </div>
        </div>
        <div className="relative z-20 shrink-0 border-b border-white/10 bg-black">
          <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-3" role="tablist" aria-label="Market groups">
            {MARKET_HEATMAP_GROUPS.map((group) => (
              <button key={group.id} type="button" role="tab" aria-selected={group.id === activeGroup} onClick={() => setActiveGroup(group.id)} className={cn("inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", group.id === activeGroup ? "border-accent bg-accent text-on-accent" : "border-border-subtle text-text-muted hover:border-accent/50 hover:text-text-primary")}>
                <OptionalSvgIcon name={group.id} selected={group.id === activeGroup} fallbackToBaseWhenSelected className={group.id === "semiconductors" ? "h-3 w-3" : "h-4 w-4"} colorClassName="text-accent" />
                {group.label}
              </button>
            ))}
          </div>
        </div>
      </>
      )}

      <div className={desktopLayout ? "flex min-h-0 min-w-0 flex-1 flex-col" : "contents"}>
      {selectedSymbol && desktopLayout ? (
        <div ref={detailColumnRef} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
          {detailLoading ? <div className="flex h-full items-center justify-center text-sm text-text-muted">Loading {selectedSymbol}…</div>
            : detailError ? <div className="p-8"><ErrorState title={`Unable to load ${selectedSymbol}`} message={detailError} /></div>
            : detail ? <div className="px-6 py-8"><DesktopStockDetail stock={detail.stock} currentPrice={detail.currentPrice} sentiment={detail.sentiment} metrics={detail.metrics} chartHeightClassName="h-[384px]" earningsCalendarContainerRef={detailColumnRef} hideCursorDateTooltip /></div>
            : null}
        </div>
      ) : <>
      <div ref={areaRef} className={cn("relative flex-1 overflow-hidden border border-white/10 bg-[#342606]", desktopLayout ? "mx-3 mt-3 min-h-0 rounded-3xl" : "min-h-0 rounded-none border-x-0 border-b-0")} role="tabpanel" aria-live="polite">
        {loading && !stocks.length && <LoadingHeatCanvas group={activeGroup} width={size.width} height={size.height} />}
        {desktopLayout ? (
          !!stocks.length && !error && <HeatCanvas stocks={heatStocks} rectangles={heatRectangles} width={size.width} height={size.height} phase={isTransitioning ? transitionProgress * 6 : 0} />
        ) : (
          <>
            {!!previousStocks?.length && isTransitioning && previousRectangles && <LegacyHeatCanvas stocks={previousStocks} rectangles={previousRectangles} width={size.width} height={size.height} className="heatmap-fade-out" />}
            {!!stocks.length && !error && <LegacyHeatCanvas key={activeGroup} stocks={stocks} rectangles={rectangles} width={size.width} height={size.height} className={isTransitioning ? "heatmap-fade-in" : undefined} />}
          </>
        )}
        {!loading && !error && <div className="absolute inset-0">
          {(desktopLayout ? heatStocks : stocks).map((stock) => {
            const rect = (desktopLayout ? heatRectangles : rectangles).get(stock.symbol);
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
              <Link key={stock.symbol} href={`/stock/${encodeURIComponent(stock.symbol)}`} onClick={(event) => { if (desktopLayout) { event.preventDefault(); setSelectedSymbol(stock.symbol); } }} className={cn("heatmap-tile absolute flex flex-col overflow-hidden border border-white/10 bg-black/15 p-3 text-left transition-opacity duration-200 hover:z-10 hover:bg-black/30 hover:ring-1 hover:ring-white/50", desktopLayout ? "rounded-3xl" : "rounded-lg")} style={tileStyle} aria-label={`${stock.name} (${stock.symbol}), ${formatPercent(stock.changePercent)}`}>
                <span className={cn("font-bold tracking-tight text-white", compact ? "text-base" : "text-2xl")}>{stock.symbol}</span>
                <span className={cn("mt-1 truncate text-white/70", compact ? "text-xs" : "text-sm")}>{stock.name}</span>
                <span className={cn("mt-auto font-semibold", compact ? "text-sm" : "text-lg", (stock.changePercent ?? 0) >= 0 ? "text-[#adfa1b]" : "text-[#ff7560]")}>{formatPercent(stock.changePercent)}</span>
              </Link>
            );
          })}
        </div>}
        {error && <div className="absolute inset-0 flex items-center justify-center text-sm text-negative">{error}</div>}
      </div>
      <div className={cn("shrink-0", desktopLayout ? "mx-3 mb-3 pt-3" : "hidden")} aria-label="Sector fund">
        {selected.sectorFund && (
          <Link
            href={`/stock/${encodeURIComponent(selected.sectorFund.symbol)}`}
            onClick={(event) => { if (desktopLayout) { event.preventDefault(); setSelectedSymbol(selected.sectorFund!.symbol); } }}
            className="flex min-h-16 w-full items-center justify-between rounded-2xl border border-white/10 bg-panel-muted/70 px-5 text-left transition-colors hover:border-accent/50 hover:bg-panel-muted"
          >
            <span>
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Sector fund</span>
              <span className="mt-1 block text-sm text-text-primary">{selected.sectorFund.name}</span>
            </span>
            <span className="text-lg font-bold text-accent">{selected.sectorFund.symbol}</span>
          </Link>
        )}
      </div>
      </>}
      </div>
      <style>{`@keyframes heatmap-fade-out { 0% { opacity: 1; } 30% { opacity: .95; } 60% { opacity: .75; } 80% { opacity: .3; } 100% { opacity: 0; } } @keyframes heatmap-fade-in { 0% { opacity: 0; } 30% { opacity: .5; } 60% { opacity: .8; } 80% { opacity: .95; } 100% { opacity: 1; } } .heatmap-fade-out, .heatmap-fade-in { animation: 1200ms cubic-bezier(.4, 0, .2, 1) both; } .heatmap-fade-out { animation-name: heatmap-fade-out; } .heatmap-fade-in { animation-name: heatmap-fade-in; } @media (prefers-reduced-motion: reduce) { .heatmap-tile, .heatmap-fade-out, .heatmap-fade-in { animation: none !important; transition: none !important; } }`}</style>
    </section>
  );
}
