"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, Sparkles, X } from "lucide-react";
import { Area, AreaChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { CandlePoint, StockDetail } from "@/types/stock";

interface Message { role: "user" | "model"; text: string; animating?: boolean }

// Context bundle the data-pill / graph widgets are computed from.
interface GraphCtx {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
  isLightMode: boolean;
}

// Split AI text on [[+]]positive[[/+]] and [[-]]negative[[/-]] tags and render coloured spans
function ColorizedText({ text }: { text: string }) {
  const parts: { str: string; type: "neutral" | "pos" | "neg" }[] = [];
  const regex = /(\[\[\+\]\])([\s\S]*?)(\[\[\/\+\]\])|(\[\[-\]\])(.*?)(\[\[\/-\]\])/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ str: text.slice(last, m.index), type: "neutral" });
    if (m[1]) parts.push({ str: m[2], type: "pos" });
    else       parts.push({ str: m[5], type: "neg" });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ str: text.slice(last), type: "neutral" });
  return (
    <>
      {parts.map((p, i) =>
        p.type === "pos" ? (
          <span key={i} style={{ color: "#00c805", fontWeight: 600 }}>{p.str}</span>
        ) : p.type === "neg" ? (
          <span key={i} style={{ color: "#ff3003", fontWeight: 600 }}>{p.str}</span>
        ) : (
          <span key={i}>{p.str}</span>
        )
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Inline data pills & graphs — the AI calls these out with [[data:KEY]] and
// [[graph:TYPE]] tags in its response text, the same way it wraps numbers in
// [[+]]/[[-]] for coloring. Each tag becomes its own block in the message:
// text before it stays above, text after it flows below.
// ─────────────────────────────────────────────────────────────────────────

const DATA_KEYS = [
  "marketCap", "peRatio", "forwardPe", "eps",
  "dividendYield", "beta", "high52", "low52", "avgVolume", "priceTarget",
] as const;
type DataKey = typeof DATA_KEYS[number];

const GRAPH_TYPES = ["price:1D","price:1W","price:1M","price:3M","price:5M","price:6M","price:1Y","price:2Y","price:5Y","price:ALL","analyst","sentiment","targets"] as const;
type GraphType = typeof GRAPH_TYPES[number];

// ─────────────────────────────────────────────────────────────────────────
// Chart annotations — the AI marks up a price graph with pure financial
// meaning (a date, a price, a label) and NEVER coordinates. The frontend
// (GraphPrice, via recharts' Reference* components) converts date/price
// into actual x/y pixel positions. Three kinds, capped per response:
//   [[mark:...]]   up to 3  — one point-in-time event (dot + vertical line)
//   [[level:...]]  up to 2  — a horizontal support/resistance/level line
//   [[region:...]] up to 1  — a shaded date-range band
// ─────────────────────────────────────────────────────────────────────────

interface MarkAnnotation   { type: "mark";   date: string; price: number; label: string; color: "positive" | "negative" | "neutral" }
interface LevelAnnotation  { type: "level";  price: number; label: string; levelType: "support" | "resistance" | "level" }
interface RegionAnnotation { type: "region"; start: string; end: string; label: string; tone: "positive" | "negative" | "neutral" }
type Annotation = MarkAnnotation | LevelAnnotation | RegionAnnotation;

const MARK_LIMIT = 3;
const LEVEL_LIMIT = 2;
const REGION_LIMIT = 1;

const MARK_TAG_RE   = /\[\[mark:([\s\S]*?)\]\]/g;
const LEVEL_TAG_RE  = /\[\[level:([\s\S]*?)\]\]/g;
const REGION_TAG_RE = /\[\[region:([\s\S]*?)\]\]/g;

// "graph=1M; date=2025-07-03; price=183.42; label=Q2 Earnings; color=neutral"
// → { graph: "1M", date: "2025-07-03", price: "183.42", label: "Q2 Earnings", color: "neutral" }
function parseAnnotationFields(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chunk of raw.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq === -1) continue;
    const key = chunk.slice(0, eq).trim();
    const val = chunk.slice(eq + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

const TONE_VALUES = ["positive", "negative", "neutral"] as const;
function asTone(v: string | undefined): "positive" | "negative" | "neutral" {
  return (TONE_VALUES as readonly string[]).includes(v ?? "") ? (v as "positive" | "negative" | "neutral") : "neutral";
}

// Strips every annotation tag out of the raw text (they never render as
// their own text/block — they only ever attach to the one price graph in
// the message) and returns what's left to parse normally, plus the parsed
// annotation list (capped per-kind, first calls win).
function extractAnnotations(text: string): { cleaned: string; annotations: Annotation[] } {
  const annotations: Annotation[] = [];

  let cleaned = text.replace(MARK_TAG_RE, (_, raw: string) => {
    if (annotations.filter(a => a.type === "mark").length >= MARK_LIMIT) return "";
    const f = parseAnnotationFields(raw);
    const price = Number(f.price);
    if (!f.date || !f.label || Number.isNaN(price)) return "";
    annotations.push({ type: "mark", date: f.date, price, label: f.label, color: asTone(f.color) });
    return "";
  });

  cleaned = cleaned.replace(LEVEL_TAG_RE, (_, raw: string) => {
    if (annotations.filter(a => a.type === "level").length >= LEVEL_LIMIT) return "";
    const f = parseAnnotationFields(raw);
    const price = Number(f.price);
    if (!f.label || Number.isNaN(price)) return "";
    const levelType = f.type === "support" || f.type === "resistance" ? f.type : "level";
    annotations.push({ type: "level", price, label: f.label, levelType });
    return "";
  });

  cleaned = cleaned.replace(REGION_TAG_RE, (_, raw: string) => {
    if (annotations.filter(a => a.type === "region").length >= REGION_LIMIT) return "";
    const f = parseAnnotationFields(raw);
    if (!f.start || !f.end || !f.label) return "";
    annotations.push({ type: "region", start: f.start, end: f.end, label: f.label, tone: asTone(f.tone) });
    return "";
  });

  return { cleaned, annotations };
}

type Segment =
  | { kind: "text"; value: string }
  | { kind: "pill"; key: DataKey }
  | { kind: "graph"; graphType: GraphType; annotations?: Annotation[] }
  | { kind: "news"; index: number };

const TAG_RE = /\[\[data:([a-zA-Z0-9_]+)\]\]|\[\[graph:([a-zA-Z0-9_:]+)\]\]|\[\[news:(\d+)\]\]/g;

// Parses AI text into an ordered list of text runs + widget calls. Enforces
// "one of a kind per message" — a repeated tag for the same key/type is
// silently dropped (the first call wins). Chart annotations are stripped
// out first and (if a price graph is present) attached to it directly.
function parseSegments(text: string): Segment[] {
  const { cleaned, annotations } = extractAnnotations(text);
  const segments: Segment[] = [];
  const seenPills = new Set<string>();
  const seenGraphs = new Set<string>();
  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(cleaned)) !== null) {
    if (m.index > last) segments.push({ kind: "text", value: cleaned.slice(last, m.index) });
    if (m[1] && DATA_KEYS.includes(m[1] as DataKey) && !seenPills.has(m[1])) {
      segments.push({ kind: "pill", key: m[1] as DataKey });
      seenPills.add(m[1]);
    } else if (m[2] && GRAPH_TYPES.includes(m[2] as GraphType) && !seenGraphs.has(m[2])) {
      const seg: Segment = { kind: "graph", graphType: m[2] as GraphType };
      if (m[2].startsWith("price") && annotations.length) seg.annotations = annotations;
      segments.push(seg);
      seenGraphs.add(m[2]);
    } else if (m[3] !== undefined) {
      const idx = parseInt(m[3]);
      segments.push({ kind: "news", index: idx });
    }
    last = TAG_RE.lastIndex;
  }
  if (last < cleaned.length) segments.push({ kind: "text", value: cleaned.slice(last) });
  return segments;
}

function toNum(v: number | string | null | undefined): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return Number.isNaN(n) ? null : n; }
  return null;
}

function computeDataPoint(key: DataKey, ctx: GraphCtx): { label: string; value: string; tone: "positive" | "negative" | "neutral" } {
  const m = ctx.metrics;
  switch (key) {
    case "marketCap": {
      const mc = ctx.stock.profile.marketCapitalization;
      return { label: "Market Cap", value: formatCompact((mc ?? 0) * 1_000_000), tone: "neutral" };
    }
    case "peRatio": {
      const pe = toNum(m?.peTTM ?? m?.peNormalizedAnnual);
      return { label: "P/E Ratio", value: pe !== null ? formatNumber(pe) : "N/A", tone: pe === null ? "neutral" : pe <= 15 ? "positive" : pe >= 30 ? "negative" : "neutral" };
    }
    case "forwardPe": {
      const fpe = toNum(m?.forwardPE);
      return { label: "Forward P/E", value: fpe !== null ? formatNumber(fpe) : "N/A", tone: fpe === null ? "neutral" : fpe <= 15 ? "positive" : fpe >= 28 ? "negative" : "neutral" };
    }
    case "eps": {
      const eps = toNum(m?.epsNormalizedAnnual ?? m?.epsTTM);
      return { label: "EPS", value: formatCurrency(eps), tone: eps === null ? "neutral" : eps > 0 ? "positive" : "negative" };
    }
    case "dividendYield": {
      const dy = toNum(m?.dividendYieldIndicatedAnnual);
      return { label: "Dividend Yield", value: formatPercent(dy), tone: dy !== null && dy >= 3 ? "positive" : "neutral" };
    }
    case "beta": {
      const b = toNum(m?.beta);
      return { label: "Beta", value: formatNumber(b), tone: b === null ? "neutral" : b < 0.8 ? "positive" : b > 1.4 ? "negative" : "neutral" };
    }
    case "high52": {
      const h = toNum(m?.["52WeekHigh"]);
      return { label: "52W High", value: formatCurrency(h), tone: "neutral" };
    }
    case "low52": {
      const l = toNum(m?.["52WeekLow"]);
      return { label: "52W Low", value: formatCurrency(l), tone: "neutral" };
    }
    case "avgVolume": {
      const v = toNum(m?.["10DayAverageTradingVolume"]);
      return { label: "Avg Volume", value: formatCompact(v ? v * 1_000_000 : null), tone: "neutral" };
    }
    case "priceTarget": {
      const t = ctx.stock.priceTarget?.targetMean;
      const tone: "positive" | "negative" | "neutral" = t && ctx.currentPrice
        ? (t > ctx.currentPrice ? "positive" : t < ctx.currentPrice ? "negative" : "neutral")
        : "neutral";
      return { label: "Avg Price Target", value: t ? formatCurrency(t) : "N/A", tone };
    }
  }
}

// A small pill — fits inline content width only, so it can never push past
// the chat bubble's own max-width. Fades/rises in on mount.
function DataPill({ dataKey, ctx }: { dataKey: DataKey; ctx: GraphCtx }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const point = computeDataPoint(dataKey, ctx);
  const color = point.tone === "positive" ? "#00c805" : point.tone === "negative" ? "#ff3003" : "#9a9aa2";
  const pillBg = ctx.isLightMode ? "#ffffff" : "#000000";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      maxWidth: "100%",
      padding: "8px 14px",
      borderRadius: 999,
      border: `1px solid ${color}55`,
      backgroundColor: pillBg,
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0) scale(1)" : "translateY(4px) scale(0.96)",
      transition: "opacity 0.22s ease, transform 0.22s ease",
    }}>
      <span style={{ height: 7, width: 7, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9a9aa2", whiteSpace: "nowrap" }}>
        {point.label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color, whiteSpace: "nowrap" }}>{point.value}</span>
    </div>
  );
}

// Sweeping shimmer shown while a graph is "generating".
function GraphShimmer() {
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden", backgroundColor: "transparent" }}>
      <div style={{
        position: "absolute", inset: 0, width: "60%",
        background: "linear-gradient(90deg, transparent, rgba(0,200,5,0.22), transparent)",
        animation: "graphShimmer 1.1s ease-in-out infinite",
      }} />
    </div>
  );
}

// Shared frame every graph renders inside — bounded so its width/height can
// never exceed the message bubble that contains it.
function GraphFrame({ title, ready, tall, children }: { title: string; ready: boolean; children: React.ReactNode; isLightMode?: boolean; tall?: boolean }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      padding: "4px 0 8px",
      overflow: "hidden",
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#00c805", marginBottom: 8 }}>
        {title}
      </p>
      <div style={{ position: "relative", height: tall ? 150 : 108, width: "100%" }}>
        {!ready && <GraphShimmer />}
        <div style={{ height: "100%", width: "100%", opacity: ready ? 1 : 0, transition: "opacity 0.25s ease" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function sentimentColor(score: number) {
  if (score <= 20) return "#dc2626";
  if (score <= 40) return "#f97316";
  if (score <= 60) return "#facc15";
  if (score <= 80) return "#a3e635";
  return "#34d399";
}

function GraphSentiment({ ctx }: { ctx: GraphCtx }) {
  const { isLightMode } = ctx;
  const [ready, setReady] = useState(false);
  const [pct, setPct] = useState(0);
  const score = ctx.sentiment.score;
  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setPct(score)));
    }, 550);
    return () => clearTimeout(t);
  }, [score]);
  const color = sentimentColor(score);
  return (
    <GraphFrame title="Sentiment Score" ready={ready} isLightMode={isLightMode}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color }}>{score}</span>
          <span style={{ fontSize: 13, color: "#9a9aa2" }}>/ 100</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)", borderRadius: 999 }} />
        </div>
      </div>
    </GraphFrame>
  );
}

function GraphAnalyst({ ctx }: { ctx: GraphCtx }) {
  const { isLightMode } = ctx;
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setProgress(1)));
    }, 550);
    return () => clearTimeout(t);
  }, []);
  const latest = ctx.stock.recommendations?.[0];
  const total = latest ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell : 0;
  const rows: [string, number, string][] = latest ? [
    ["Strong Buy", latest.strongBuy, "#34d399"],
    ["Buy", latest.buy, "#a3e635"],
    ["Hold", latest.hold, "#facc15"],
    ["Sell", latest.sell, "#f97316"],
    ["Strong Sell", latest.strongSell, "#dc2626"],
  ] : [];
  return (
    <GraphFrame title="Analyst Recommendations" ready={ready} isLightMode={isLightMode}>
      {total === 0 ? (
        <div style={{ display: "flex", alignItems: "center", height: "100%", fontSize: 13, color: "#9a9aa2" }}>
          No analyst coverage available.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, height: "100%" }}>
          {rows.map(([label, count, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, width: 62, color: "#9a9aa2", flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${progress * Math.max((count / total) * 100, count ? 4 : 0)}%`,
                  backgroundColor: color,
                  transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                  borderRadius: 999,
                }} />
              </div>
              <span style={{ fontSize: 11, width: 16, textAlign: "right", color: "#f0f0f2", flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </GraphFrame>
  );
}

function GraphTargets({ ctx }: { ctx: GraphCtx }) {
  const { isLightMode } = ctx;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 550);
    return () => clearTimeout(t);
  }, []);
  const pt = ctx.stock.priceTarget;
  const hasData = pt?.targetLow != null && pt?.targetHigh != null && pt.targetHigh > pt.targetLow;
  return (
    <GraphFrame title="Analyst Price Targets" ready={ready} isLightMode={isLightMode}>
      {!hasData ? (
        <div style={{ display: "flex", alignItems: "center", height: "100%", fontSize: 13, color: "#9a9aa2" }}>
          No price target data available.
        </div>
      ) : (() => {
        const low = pt.targetLow as number;
        const high = pt.targetHigh as number;
        const mean = pt.targetMean ?? (low + high) / 2;
        const span = Math.max(high - low, 0.01);
        const pct = (v: number) => Math.min(100, Math.max(0, ((v - low) / span) * 100));
        return (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, height: "100%" }}>
            <div style={{ position: "relative", height: 6, borderRadius: 999, backgroundColor: "rgba(128,128,128,0.18)" }}>
              <div style={{ position: "absolute", left: `${pct(mean)}%`, top: -4, width: 2, height: 14, backgroundColor: "#9a9aa2", transform: "translateX(-50%)" }} />
              <div style={{
                position: "absolute", left: `${pct(ctx.currentPrice)}%`, top: -6, width: 12, height: 12,
                borderRadius: "50%", backgroundColor: "#00c805", border: "2px solid #000", transform: "translateX(-50%)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9a9aa2" }}>
              <span>Low {formatCurrency(low)}</span>
              <span>Mean {formatCurrency(mean)}</span>
              <span>High {formatCurrency(high)}</span>
            </div>
          </div>
        );
      })()}
    </GraphFrame>
  );
}

// Finds the candle whose date is closest to a target date string — this is
// the ONLY thing that turns an AI-given date into a chart position; the AI
// itself never sees or picks pixel/x coordinates.
function nearestCandleDate(points: CandlePoint[], targetDate: string): string | null {
  const target = new Date(targetDate).getTime();
  if (Number.isNaN(target)) return null;
  let best: CandlePoint | null = null;
  let bestDiff = Infinity;
  for (const p of points) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return best?.date ?? null;
}

const ANNOTATION_COLOR: Record<"positive" | "negative" | "neutral", string> = {
  positive: "#00c805",
  negative: "#ff3003",
  neutral:  "#9a9aa2",
};

// Point annotations are always neutral grey — never colored red/green, even
// though the tag itself still accepts a color field for backwards
// compatibility. Only levels (support/resistance) and regions use tone color.
const MARK_COLOR = "#9a9aa2";

// Recharts' label prop receives the dot's own pixel box for a ReferenceDot,
// letting us offset the label text away from the marker without ever
// touching data/pixel coordinates ourselves in the annotation language.
function markLabelRenderer(text: string, xSide: "left" | "right", ySide: "above" | "below") {
  function MarkLabel(props: { viewBox?: { x?: number; y?: number; width?: number; height?: number } }) {
    const vb = props.viewBox;
    if (!vb || vb.x == null || vb.y == null) return <g />;
    const cx = vb.x + (vb.width ?? 0) / 2;
    const cy = vb.y + (vb.height ?? 0) / 2;
    const dx = xSide === "left" ? -7 : 7;
    const dy = ySide === "above" ? -8 : 15;
    return (
      <text
        x={cx + dx}
        y={cy + dy}
        textAnchor={xSide === "left" ? "end" : "start"}
        fontSize={9}
        fontWeight={600}
        fill={MARK_COLOR}
      >
        {text}
      </text>
    );
  }
  return MarkLabel;
}

function GraphPrice({ ctx, period = "1M", annotations }: { ctx: GraphCtx; period?: string; annotations?: Annotation[] }) {
  const [ready, setReady] = useState(false);
  const [points, setPoints] = useState<CandlePoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { isLightMode } = ctx;

  const periodLabel: Record<string, string> = {
    "1D":"Today","1W":"1 Week","1M":"1 Month","3M":"3 Months",
    "5M":"5 Months","6M":"6 Months","1Y":"1 Year","2Y":"2 Years","5Y":"5 Years","ALL":"All Time",
  };

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise(resolve => setTimeout(resolve, 550));
    (async () => {
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(ctx.stock.symbol)}&period=${period}`);
        const data = await res.json() as { candles?: CandlePoint[]; error?: string };
        await minDelay;
        if (cancelled) return;
        if (data.candles?.length) {
          // For 1D: prepend previous day's close as the first point (same as PriceChart + watchlist)
          if (period === "1D" && ctx.stock.quote.pc && ctx.stock.quote.pc > 0) {
            const prevPoint: CandlePoint = { close: ctx.stock.quote.pc, date: data.candles[0].date, time: data.candles[0].time - 1 };
            setPoints([prevPoint, ...data.candles]);
          } else {
            setPoints(data.candles);
          }
        } else setFailed(true);
      } catch {
        await minDelay;
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [ctx.stock.symbol, period, ctx.stock.quote.pc]);

  const positive = !points || points.length < 2 ? true : points[points.length - 1].close >= points[0].close;
  const lineColor = positive ? "#00c805" : "#ff3003";
  const hasAnnotations = !!annotations?.length;

  // Shared domain used to decide "near the top/bottom edge" for label
  // placement — mirrors what ifOverflow="extendDomain" would settle on.
  let priceDomainMin = 0, priceDomainMax = 0;
  if (points?.length) {
    const values = points.map(p => p.close);
    if (annotations) {
      for (const a of annotations) {
        if (a.type === "mark" || a.type === "level") values.push(a.price);
      }
    }
    priceDomainMin = Math.min(...values);
    priceDomainMax = Math.max(...values);
  }
  const priceSpan = Math.max(priceDomainMax - priceDomainMin, 0.0001);

  return (
    <GraphFrame title={`Price — ${periodLabel[period] ?? period}`} ready={ready} isLightMode={isLightMode} tall={hasAnnotations}>
      {failed || !points?.length ? (
        <div style={{ display: "flex", alignItems: "center", height: "100%", fontSize: 13, color: "#9a9aa2" }}>
          Price history unavailable.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: hasAnnotations ? 14 : 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="miniAiChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area type="monotone" dataKey="close" stroke={lineColor} fill="url(#miniAiChartFill)" strokeWidth={2} dot={false} isAnimationActive={false} />

            {annotations?.filter((a): a is RegionAnnotation => a.type === "region").map((a, i) => {
              const x1 = nearestCandleDate(points, a.start);
              const x2 = nearestCandleDate(points, a.end);
              if (!x1 || !x2) return null;
              const color = ANNOTATION_COLOR[a.tone];
              return (
                <ReferenceArea
                  key={`region-${i}`}
                  x1={x1} x2={x2}
                  fill={color} fillOpacity={0.12}
                  stroke={color} strokeOpacity={0.3}
                  label={{ value: a.label, position: "insideTop", fontSize: 9, fontWeight: 600, fill: color }}
                  ifOverflow="extendDomain"
                />
              );
            })}

            {annotations?.filter((a): a is LevelAnnotation => a.type === "level").map((a, i) => {
              const color = a.levelType === "support" ? "#00c805" : a.levelType === "resistance" ? "#ff3003" : "#9a9aa2";
              // Keep the label off the chart edge the same way marks do —
              // if the level sits near the top/bottom, hug the opposite side.
              const yProp = (a.price - priceDomainMin) / priceSpan;
              const position = yProp >= 0.8 ? "insideBottomRight" : yProp <= 0.2 ? "insideTopRight" : "insideBottomRight";
              return (
                <ReferenceLine
                  key={`level-${i}`}
                  y={a.price}
                  stroke={color}
                  strokeDasharray="4 3"
                  strokeWidth={1.25}
                  ifOverflow="extendDomain"
                  label={{ value: a.label, position, fontSize: 9, fontWeight: 600, fill: color }}
                />
              );
            })}

            {/* Point annotations — always neutral grey. Vertical line has no
                label of its own; the dot carries a custom-positioned label
                chosen to avoid the chart edges and the price line itself. */}
            {annotations?.filter((a): a is MarkAnnotation => a.type === "mark").map((a, i) => {
              const x = nearestCandleDate(points, a.date);
              if (!x) return null;
              return (
                <ReferenceLine
                  key={`mark-line-${i}`}
                  x={x}
                  stroke={MARK_COLOR}
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              );
            })}
            {annotations?.filter((a): a is MarkAnnotation => a.type === "mark").map((a, i) => {
              const x = nearestCandleDate(points, a.date);
              if (!x) return null;

              // Horizontal: hug whichever side has room — near the right
              // edge, the label goes left of the line, and vice versa.
              const idx = points.findIndex(p => p.date === x);
              const xProp = points.length > 1 ? idx / (points.length - 1) : 0.5;
              const xSide: "left" | "right" = xProp >= 0.72 ? "left" : "right";

              // Vertical: keep the label off the price line — if the point
              // sits high on the chart, drop the label below it, and if it
              // sits low, lift the label above it.
              const yProp = (a.price - priceDomainMin) / priceSpan;
              const ySide: "above" | "below" = yProp >= 0.7 ? "below" : "above";

              return (
                <ReferenceDot
                  key={`mark-dot-${i}`}
                  x={x} y={a.price}
                  r={3.5}
                  fill={MARK_COLOR}
                  stroke={isLightMode ? "#fff" : "#000"}
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                  label={markLabelRenderer(a.label, xSide, ySide)}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </GraphFrame>
  );
}

function NewsCard({ index, ctx }: { index: number; ctx: GraphCtx }) {
  const article = ctx.stock.news?.[index];
  if (!article) return null;
  const isLightMode = ctx.isLightMode;
  const bg = isLightMode ? "#ffffff" : "#000000";
  const border = isLightMode ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)";
  const text = isLightMode ? "#1a1a1e" : "#f0f0f2";
  const muted = isLightMode ? "#6e6e80" : "#9a9aa2";
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        textDecoration: "none",
        cursor: "pointer",
      }}
      onClick={e => e.stopPropagation()}
    >
      {article.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.image} alt="" style={{ width: 52, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 52, height: 40, borderRadius: 6, backgroundColor: "rgba(128,128,128,0.15)", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text, lineHeight: 1.4,
          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {article.headline}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: muted }}>{article.source}</p>
      </div>
    </a>
  );
}

function GraphWidget({ graphType, annotations, ctx }: { graphType: GraphType; annotations?: Annotation[]; ctx: GraphCtx }) {
  if (graphType.startsWith("price")) {
    const period = graphType.includes(":") ? graphType.split(":")[1] : "1M";
    return <GraphPrice ctx={ctx} period={period} annotations={annotations} />;
  }
  switch (graphType) {
    case "analyst":   return <GraphAnalyst ctx={ctx} />;
    case "sentiment": return <GraphSentiment ctx={ctx} />;
    case "targets":   return <GraphTargets ctx={ctx} />;
    default:          return null;
  }
}

function Cursor() {
  return (
    <span style={{
      display: "inline-block",
      width: "2px",
      height: "1em",
      marginLeft: "2px",
      verticalAlign: "text-bottom",
      backgroundColor: "#00c805",
      borderRadius: "1px",
      boxShadow: "0 0 6px 2px rgba(0,200,5,0.7)",
      animation: "aiCursor 0.7s ease-in-out infinite",
    }} />
  );
}

// Renders a parsed message: text runs flow normally, pills/graphs each get
// their own block so any text written after them appears underneath.
function MessageSegments({ segments, ctx, trailingCursor }: { segments: Segment[]; ctx: GraphCtx; trailingCursor: boolean }) {
  const cleaned = segments.filter(s => s.kind !== "text" || s.value.length > 0);
  if (cleaned.length === 0) return trailingCursor ? <Cursor /> : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {cleaned.map((seg, i) => {
        const isLast = i === cleaned.length - 1;
        if (seg.kind === "text") {
          return (
            <span key={i}>
              <ColorizedText text={seg.value} />
              {isLast && trailingCursor && <Cursor />}
            </span>
          );
        }
        if (seg.kind === "pill") {
          return (
            <div key={i}>
              <DataPill dataKey={seg.key} ctx={ctx} />
              {isLast && trailingCursor && <Cursor />}
            </div>
          );
        }
        if (seg.kind === "news") {
          return (
            <div key={i}>
              <NewsCard index={seg.index} ctx={ctx} />
              {isLast && trailingCursor && <Cursor />}
            </div>
          );
        }
        return (
          <div key={i}>
            <GraphWidget graphType={seg.graphType} annotations={seg.annotations} ctx={ctx} />
            {isLast && trailingCursor && <Cursor />}
          </div>
        );
      })}
    </div>
  );
}

// Market hours helper (ET)
function getMarketInfo(): { isOpen: boolean; status: string; timeToEvent: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(); // 0=Sun,6=Sat
  const h = et.getHours(), m = et.getMinutes();
  const minOfDay = h * 60 + m;
  const openMin = 9 * 60 + 30;   // 9:30 AM ET
  const closeMin = 16 * 60;       // 4:00 PM ET
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && minOfDay >= openMin && minOfDay < closeMin;

  function minsToHHMM(mins: number) {
    const hh = Math.floor(mins / 60), mm = mins % 60;
    return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  }

  let timeToEvent = "";
  if (isOpen) {
    timeToEvent = `closes in ${minsToHHMM(closeMin - minOfDay)}`;
  } else if (isWeekday && minOfDay < openMin) {
    timeToEvent = `opens in ${minsToHHMM(openMin - minOfDay)}`;
  } else {
    // Find next Monday (or next day) open
    const daysUntilMon = ((8 - day) % 7) || 7;
    const nextOpen = day === 6 ? 2 : day === 0 ? 1 : daysUntilMon;
    timeToEvent = `opens in ~${nextOpen} day${nextOpen > 1 ? "s" : ""}`;
  }
  return { isOpen, status: isOpen ? "Open" : "Closed", timeToEvent };
}

// Deterministic market statistics computed straight from candle data — the
// AI explains these, it never calculates them itself. Also gives the AI
// grounded, exact dates it can safely reference in [[mark:...]] tags.
function computeMarketStats(candles: CandlePoint[]): string | null {
  if (!candles || candles.length < 5) return null;

  const closes  = candles.map(c => c.close);
  const dates   = candles.map(c => c.date.slice(0, 10));
  const volumes = candles.map(c => c.volume ?? 0);
  const fmtPct  = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  let largestGain = { pct: -Infinity, date: "" };
  let largestLoss = { pct: Infinity, date: "" };
  for (let i = 1; i < closes.length; i++) {
    const pct = (closes[i] - closes[i - 1]) / closes[i - 1] * 100;
    if (pct > largestGain.pct) largestGain = { pct, date: dates[i] };
    if (pct < largestLoss.pct) largestLoss = { pct, date: dates[i] };
  }

  let highestClose = { price: -Infinity, date: "" };
  let lowestClose   = { price: Infinity, date: "" };
  closes.forEach((c, i) => {
    if (c > highestClose.price) highestClose = { price: c, date: dates[i] };
    if (c < lowestClose.price)  lowestClose   = { price: c, date: dates[i] };
  });

  let highestVolume = { volume: -Infinity, date: "" };
  volumes.forEach((v, i) => { if (v > highestVolume.volume) highestVolume = { volume: v, date: dates[i] }; });
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  const movingAvg = (n: number) => closes.length < n ? null : closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const ma20 = movingAvg(20);
  const ma50 = movingAvg(50);

  let peak = closes[0], maxDrawdown = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    maxDrawdown = Math.min(maxDrawdown, (c - peak) / peak * 100);
  }

  const percentReturn = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;

  let trend: "Uptrend" | "Downtrend" | "Sideways" = "Sideways";
  if (ma20 !== null && ma50 !== null) {
    if (ma20 > ma50 * 1.01) trend = "Uptrend";
    else if (ma20 < ma50 * 0.99) trend = "Downtrend";
  }

  const periodHigh = Math.max(...closes);
  const periodLow  = Math.min(...closes);
  const lastClose  = closes[closes.length - 1];
  const distFromHigh = (lastClose - periodHigh) / periodHigh * 100;
  const distFromLow  = (lastClose - periodLow)  / periodLow  * 100;

  const tail = closes.slice(-21);
  const recentReturns: number[] = [];
  for (let i = 1; i < tail.length; i++) recentReturns.push((tail[i] - tail[i - 1]) / tail[i - 1] * 100);
  const meanRet = recentReturns.reduce((a, b) => a + b, 0) / (recentReturns.length || 1);
  const variance = recentReturns.reduce((a, b) => a + (b - meanRet) ** 2, 0) / (recentReturns.length || 1);
  const stdev = Math.sqrt(variance);

  const lines = [
    `Largest Daily Gain: ${fmtPct(largestGain.pct)} on ${largestGain.date}`,
    `Largest Daily Loss: ${fmtPct(largestLoss.pct)} on ${largestLoss.date}`,
    `Highest Close: $${highestClose.price.toFixed(2)} on ${highestClose.date}`,
    `Lowest Close: $${lowestClose.price.toFixed(2)} on ${lowestClose.date}`,
    highestVolume.volume > 0 ? `Highest Volume Day: ${(highestVolume.volume / 1_000_000).toFixed(1)}M shares on ${highestVolume.date}` : null,
    avgVolume > 0 ? `Average Volume: ${(avgVolume / 1_000_000).toFixed(1)}M shares/day` : null,
    ma20 !== null ? `20-Day Moving Average: $${ma20.toFixed(2)}` : null,
    ma50 !== null ? `50-Day Moving Average: $${ma50.toFixed(2)}` : null,
    `Max Drawdown: ${maxDrawdown.toFixed(2)}%`,
    `Current Trend: ${trend}`,
    `Percentage Return (over fetched period): ${fmtPct(percentReturn)}`,
    `Distance from Period High: ${fmtPct(distFromHigh)}`,
    `Distance from Period Low: ${fmtPct(distFromLow)}`,
    `Recent Volatility (20-day stdev of daily returns): ${stdev.toFixed(2)}%`,
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}

// Fetch key candle stats for a period (async, called server-side in context builder)
async function fetchPeriodStats(symbol: string, period: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}`, { cache: "no-store" });
    const data = await res.json() as { candles?: { close: number; date: string }[] };
    const candles = data.candles;
    if (!candles || candles.length < 2) return null;
    const closes = candles.map(c => c.close);
    const dates = candles.map(c => c.date.slice(0, 10));
    const first = closes[0], last = closes[closes.length - 1];
    // Find the exact date of this period's high/low directly from its own
    // candle set — never borrow a date computed over a different period.
    let highIdx = 0, lowIdx = 0;
    closes.forEach((c, i) => {
      if (c > closes[highIdx]) highIdx = i;
      if (c < closes[lowIdx]) lowIdx = i;
    });
    const high = closes[highIdx], low = closes[lowIdx];
    const chg = ((last - first) / first * 100).toFixed(2);
    const sign = parseFloat(chg) >= 0 ? "+" : "";
    return `${period}: ${sign}${chg}% | High $${high.toFixed(2)} on ${dates[highIdx]} | Low $${low.toFixed(2)} on ${dates[lowIdx]} | Start $${first.toFixed(2)} | End $${last.toFixed(2)}`;
  } catch {
    return null;
  }
}

// Fetches a full year of daily candles so computeMarketStats has enough
// history for 50-day moving averages, drawdown, and 52-week distances.
async function fetchCandlesForStats(symbol: string): Promise<CandlePoint[] | null> {
  try {
    const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&period=1Y`, { cache: "no-store" });
    const data = await res.json() as { candles?: CandlePoint[] };
    return data.candles?.length ? data.candles : null;
  } catch {
    return null;
  }
}

const ARTICLE_EXTRACT_TIMEOUT_MS = 7000;
// How many of the most recent news items we bother fully fetching + reading
// (rather than just listing the headline/summary). Kept small since most
// financial news sites paywall or block scraping, and each attempt costs a
// full page fetch — cap the blast radius and let the rest fall back to the
// existing blurb.
const ARTICLES_TO_READ = 3;

// Server-side fetch + Readability extraction of one article's full text.
// Returns null on any failure (paywall, timeout, blocked, non-HTML, etc.)
// so the caller can silently fall back to the headline/summary blurb.
async function fetchArticleExtract(url: string): Promise<{ title: string | null; text: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ARTICLE_EXTRACT_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/article-extract?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json() as { title?: string | null; text?: string; error?: string };
      if (!data.text) return null;
      return { title: data.title ?? null, text: data.text };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

// buildStockContext now async so it can prefetch graph data
export async function buildStockContextAsync(
  stock: StockDetail,
  currentPrice: number,
  sentiment: { score: number; drivers: string[] },
  metrics: Record<string, number | string | null> | undefined
): Promise<string> {
  const market = getMarketInfo();
  const now = new Date();

  const lines: string[] = [
    `Date/Time: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })} ET`,
    `Market: ${market.status} (${market.timeToEvent})`,
    `Stock: ${stock.profile.name ?? stock.symbol} (${stock.symbol})`,
    `Exchange: ${stock.profile.exchange ?? "N/A"}`,
    `Industry: ${stock.profile.finnhubIndustry ?? "N/A"}`,
    `Current Price: $${currentPrice.toFixed(2)}`,
    `Day Change: ${stock.quote.dp?.toFixed(2) ?? "N/A"}%`,
    `Previous Close: $${stock.quote.pc?.toFixed(2) ?? "N/A"}`,
    `52W High: $${stock.quote.h?.toFixed(2) ?? "N/A"} | 52W Low: $${stock.quote.l?.toFixed(2) ?? "N/A"}`,
    `Sentiment Score: ${sentiment.score}/100 (${sentiment.drivers.join(", ")})`,
  ];

  if (metrics) {
    const ml = Object.entries(metrics).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
    if (ml.length) lines.push(`Fundamentals: ${ml.join(" | ")}`);
  }
  const a = stock.recommendations?.[0];
  if (a) lines.push(`Analyst: Strong Buy ${a.strongBuy} | Buy ${a.buy} | Hold ${a.hold} | Sell ${a.sell} | Strong Sell ${a.strongSell}`);
  if (stock.priceTarget?.targetMean) lines.push(`Avg Price Target: $${stock.priceTarget.targetMean.toFixed(2)}`);

  // Fetch graph stats for key periods, a year of daily candles for
  // deterministic market statistics, and full article text for the most
  // recent news items — all in parallel so total wait time is bounded by
  // the slowest single fetch, not their sum.
  const periods = ["1D","1W","1M","3M","5M","6M","1Y","2Y","5Y","ALL"];
  const newsItems = stock.news?.slice(0, 8) ?? [];
  const [stats, statsCandles, articleExtracts] = await Promise.all([
    Promise.all(periods.map(p => fetchPeriodStats(stock.symbol, p))),
    fetchCandlesForStats(stock.symbol),
    Promise.all(newsItems.slice(0, ARTICLES_TO_READ).map(n => n.url ? fetchArticleExtract(n.url) : null)),
  ]);
  const validStats = stats.filter(Boolean);
  if (validStats.length) lines.push(`Graph Data:\n${validStats.join("\n")}`);

  if (statsCandles) {
    const marketStats = computeMarketStats(statsCandles);
    if (marketStats) {
      lines.push(`Market Statistics — trailing 1 year only (already computed — cite these directly, do not recalculate; use these exact dates/prices for [[mark:...]] annotations). For questions scoped to a specific period (e.g. "last 5 months"), use that period's own line under Graph Data instead — it has the exact high/low dates for that exact window:\n${marketStats}`);
    }
  }

  if (newsItems.length) {
    const h = newsItems.map((n, i) => {
      const extract = articleExtracts[i];
      if (extract?.text) {
        return `[${i}] ${n.headline} (${n.source})\n    Full Article Text (extracted from the source page — you have actually read this one): ${extract.text}`;
      }
      return `[${i}] ${n.headline} (${n.source})${n.summary ? `\n    Summary only (full article was not readable — treat as a brief blurb, do not claim to have read the full piece): ${n.summary}` : ""}`;
    }).join("\n");
    lines.push(`Recent News (use [[news:INDEX]] to show one):\n${h}`);
  }
  return lines.join("\n");
}

function buildStockContext(
  stock: StockDetail,
  currentPrice: number,
  sentiment: { score: number; drivers: string[] },
  metrics: Record<string, number | string | null> | undefined
): string {
  // Sync fallback used on first render — async version is fetched on open
  const market = getMarketInfo();
  const now = new Date();
  const lines: string[] = [
    `Date/Time: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" })} ET`,
    `Market: ${market.status} (${market.timeToEvent})`,
    `Stock: ${stock.profile.name ?? stock.symbol} (${stock.symbol})`,
    `Exchange: ${stock.profile.exchange ?? "N/A"}`,
    `Industry: ${stock.profile.finnhubIndustry ?? "N/A"}`,
    `Current Price: $${currentPrice.toFixed(2)}`,
    `Day Change: ${stock.quote.dp?.toFixed(2) ?? "N/A"}%`,
    `Previous Close: $${stock.quote.pc?.toFixed(2) ?? "N/A"}`,
    `52W High: $${stock.quote.h?.toFixed(2) ?? "N/A"} | 52W Low: $${stock.quote.l?.toFixed(2) ?? "N/A"}`,
    `Sentiment Score: ${sentiment.score}/100 (${sentiment.drivers.join(", ")})`,
  ];
  if (metrics) {
    const ml = Object.entries(metrics).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
    if (ml.length) lines.push(`Fundamentals: ${ml.join(" | ")}`);
  }
  const a = stock.recommendations?.[0];
  if (a) lines.push(`Analyst: Strong Buy ${a.strongBuy} | Buy ${a.buy} | Hold ${a.hold} | Sell ${a.sell} | Strong Sell ${a.strongSell}`);
  if (stock.priceTarget?.targetMean) lines.push(`Avg Price Target: $${stock.priceTarget.targetMean.toFixed(2)}`);
  if (stock.news?.length) {
    const h = stock.news.slice(0, 8).map((n, i) =>
      `[${i}] ${n.headline} (${n.source})${n.summary ? `\n    Summary: ${n.summary}` : ""}`
    ).join("\n");
    lines.push(`Recent News (use [[news:INDEX]] to show one):\n${h}`);
  }
  return lines.join("\n");
}

// Streams AI text character by character with a green glow on the last char.
// Widget tags ([[data:...]] / [[graph:...]]) only render once they've fully
// streamed in, then hold steady while the rest of the message keeps typing.
function AnimatedMessageBody({ text, ctx, onDone }: { text: string; ctx: GraphCtx; onDone: () => void }) {
  const [count, setCount] = useState(0);
  const isDone = count >= text.length;

  useEffect(() => {
    setCount(0);
    const iv = setInterval(() => {
      setCount(c => {
        if (c >= text.length) { clearInterval(iv); onDone(); return c; }
        return c + 1;
      });
    }, 6);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const slice = text.slice(0, count);
  const segments = parseSegments(slice);

  return <MessageSegments segments={segments} ctx={ctx} trailingCursor={!isDone} />;
}

function StaticMessageBody({ text, ctx }: { text: string; ctx: GraphCtx }) {
  const segments = parseSegments(text);
  return <MessageSegments segments={segments} ctx={ctx} trailingCursor={false} />;
}

interface Props {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
  /** If provided, open state is controlled externally (e.g. desktop's own button) instead of the built-in floating pill. */
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in floating pill trigger — used when an external button opens the chat instead. */
  hideTrigger?: boolean;
}

export function StockAIChat({ stock, currentPrice, sentiment, metrics, externalOpen, onOpenChange, hideTrigger }: Props) {
  const [mounted, setMounted] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  function setOpen(v: boolean) {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [vp, setVp] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const scrollRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const touchStart  = useRef<{ x: number; y: number; time: number } | null>(null);
  const [stockContext, setStockContext] = useState(() => buildStockContext(stock, currentPrice, sentiment, metrics));

  // On first open, fetch full context with graph data (async)
  useEffect(() => {
    if (!open) return;
    buildStockContextAsync(stock, currentPrice, sentiment, metrics).then(ctx => setStockContext(ctx));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const isLightMode = typeof document !== "undefined" && document.documentElement.classList.contains("light-mode");
  const graphCtx: GraphCtx = { stock, currentPrice, sentiment, metrics, isLightMode };

  // Render via a portal straight into <body> — bypasses ancestor elements
  // (like <main>) that can pick up a transient CSS `transform` from page
  // transition animations. A transformed ancestor becomes a new containing
  // block for any `position: fixed` descendant, which silently breaks fixed
  // positioning. Portaling to <body> guarantees this can never happen, the
  // same way the always-reliable search button lives outside <main> too.
  useEffect(() => setMounted(true), []);

  // Track visual viewport — only needed on mobile (iOS keyboard shrinking).
  // On desktop (width >= 1024) skip entirely to avoid unnecessary rerenders.
  useEffect(() => {
    function update() {
      if (window.innerWidth >= 1024) {
        // Desktop: use simple full-window dimensions, no polling needed
        setVp({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
        return;
      }
      const vv = window.visualViewport;
      setVp(vv
        ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
      );
    }
    update();
    // Only attach expensive visualViewport listeners on mobile
    if (window.innerWidth < 1024) {
      window.visualViewport?.addEventListener("resize", update);
      window.visualViewport?.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Lock body scroll (without jumping to top) only while chat is open
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const b = document.body;
    b.style.overflow = "hidden";
    b.style.position = "fixed";
    b.style.top      = `-${scrollY}px`;
    b.style.left     = "0";
    b.style.right    = "0";
    const t = setTimeout(() => inputRef.current?.focus(), 340);
    return () => {
      clearTimeout(t);
      b.style.overflow = b.style.position = b.style.top = b.style.left = b.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  function handleDismiss() {
    setOpen(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, text: m.text })), stockContext }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setMessages(prev => [...prev, { role: "model", text: data.text ?? data.error ?? "No response.", animating: true }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function markDone(i: number) {
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, animating: false } : m));
  }

  // Tap-to-dismiss on empty space: a quick tap (not a scroll/drag) that lands
  // directly on the blank scroll area — not on a message bubble — closes the
  // chat, same as tapping the backdrop above it.
  function onEmptyAreaTouchStart(e: React.TouchEvent) {
    if (e.target !== e.currentTarget) { touchStart.current = null; return; }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  }
  function onEmptyAreaTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    const dt = Date.now() - touchStart.current.time;
    if (dx < 8 && dy < 8 && dt < 300) handleDismiss();
    touchStart.current = null;
  }
  function onEmptyAreaClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleDismiss();
  }

  const bgBubbleAI    = isLightMode ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.72)";
  const bubbleBorder  = isLightMode ? "rgba(0,0,0,0.10)"    : "rgba(255,255,255,0.10)";
  const textColor     = isLightMode ? "#1a1a1e"             : "#f0f0f2";

  const vpW = vp.width  || (typeof window !== "undefined" ? window.innerWidth  : 0);
  const vpH = vp.height || (typeof window !== "undefined" ? window.innerHeight : 0);

  // How much the keyboard (or Safari's chrome) is eating into the screen —
  // used to keep the pill glued just above it instead of drifting/getting covered.
  const winH = typeof window !== "undefined" ? window.innerHeight : 0;
  const keyboardInset = Math.max(0, winH - vpH - vp.top);
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;
  const pillBottom = isDesktop
    ? "1.5rem"
    : open && keyboardInset > 8
      ? `${keyboardInset + 12}px`
      : "calc(1.25rem + env(safe-area-inset-bottom))";

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop + messages — pinned to the exact visual viewport rectangle */}
      <div
        style={{
          position: "fixed",
          top: vp.top, left: vp.left, width: vpW, height: vpH,
          zIndex: 1000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            backdropFilter:       open ? "blur(20px) brightness(0.88)" : "none",
            WebkitBackdropFilter: open ? "blur(20px) brightness(0.88)" : "none",
            transition: "backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease",
          }}
          onClick={handleDismiss}
        />

        {/* Messages — scrollable, tapping blank space (not a bubble) dismisses */}
        <div
          ref={scrollRef}
          style={{
            position: "absolute",
            left: 0, right: 0,
            top: "max(3rem, calc(env(safe-area-inset-top) + 1rem))",
            bottom: `calc(${pillBottom} + 4.5rem)`,
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 12,
            padding: "16px 14px 8px",
          }}
          onClick={onEmptyAreaClick}
          onTouchStart={onEmptyAreaTouchStart}
          onTouchEnd={onEmptyAreaTouchEnd}
        >
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "86%",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
                padding: "12px 18px",
                borderRadius: msg.role === "user" ? "20px 20px 5px 20px" : "20px 20px 20px 5px",
                backgroundColor: msg.role === "user" ? "rgba(0,200,5,0.75)" : bgBubbleAI,
                border: msg.role === "model" ? `1px solid ${bubbleBorder}` : "none",
                color: msg.role === "user" ? "#000" : textColor,
                fontSize: 17,
                lineHeight: 1.55,
                fontWeight: msg.role === "user" ? 500 : 400,
              }}>
                {msg.role === "model" && msg.animating
                  ? <AnimatedMessageBody text={msg.text} ctx={graphCtx} onDone={() => markDone(i)} />
                  : msg.role === "model"
                    ? <StaticMessageBody text={msg.text} ctx={graphCtx} />
                    : msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                padding: "14px 18px",
                borderRadius: "20px 20px 20px 5px",
                backgroundColor: bgBubbleAI,
                border: `1px solid ${bubbleBorder}`,
                display: "flex", gap: 7, alignItems: "center",
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    display: "block", height: 7, width: 7,
                    borderRadius: "50%", backgroundColor: "#00c805",
                    animation: `aiDot 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The pill — always mounted, same element morphs from a small circle
          (matching the search button exactly) into the full input bar. No
          separate bar/card behind it — this IS the input, elongated. */}
      {!hideTrigger && (
      <div
        className="fixed rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-positive overflow-hidden"
        style={{
          zIndex: 1002,
          bottom: pillBottom,
          right: open ? "1rem" : "1.25rem",
          width: open ? "calc(100vw - 2rem)" : "3.5rem",
          height: "3.5rem",
          transition: "width 0.32s cubic-bezier(0.2,0,0,1), right 0.32s cubic-bezier(0.2,0,0,1), bottom 0.2s ease",
        }}
      >
        {/* Closed state: the trigger icon */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: open ? 0 : 1,
            pointerEvents: open ? "none" : "auto",
            transition: "opacity 0.16s ease",
          }}
        >
          <Sparkles className="h-7 w-7" />
        </button>

        {/* Open state: the actual input row */}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 8px 0 20px",
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transition: "opacity 0.22s ease",
            transitionDelay: open ? "0.14s" : "0s",
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Ask about ${stock.symbol}…`}
            className="text-text-primary placeholder:text-text-muted"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 16,
              caretColor: "#00c805",
            }}
          />
          {input.trim() ? (
            <button
              onClick={sendMessage}
              disabled={loading}
              style={{
                flexShrink: 0, height: 38, width: 38,
                borderRadius: "50%",
                backgroundColor: !loading ? "#00c805" : "rgba(0,200,5,0.18)",
                color: !loading ? "#000" : "rgba(0,200,5,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none",
                cursor: !loading ? "pointer" : "default",
                transition: "background-color 0.18s, color 0.18s",
              }}
            >
              <Send style={{ height: 15, width: 15 }} />
            </button>
          ) : (
            <button
              onClick={handleDismiss}
              aria-label="Close chat"
              style={{
                flexShrink: 0, height: 38, width: 38,
                borderRadius: "50%",
                backgroundColor: "rgba(0,200,5,0.18)",
                color: "#00c805",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.18s, color 0.18s",
              }}
            >
              <X style={{ height: 16, width: 16 }} />
            </button>
          )}
        </div>
      </div>
      )}

      {/* Controlled mode (e.g. desktop): render just the input row inline where hideTrigger is set and open is true, anchored bottom same as mobile pill would be, so typing still works without the floating circle. */}
      {hideTrigger && open && (
        <div
          className="fixed rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-positive overflow-hidden"
          style={{
            zIndex: 1002,
            bottom: pillBottom,
            right: "1rem",
            width: "calc(100vw - 2rem)",
            maxWidth: "480px",
            height: "3.5rem",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 8px 0 20px",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Ask about ${stock.symbol}…`}
              className="text-text-primary placeholder:text-text-muted"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, caretColor: "#00c805" }}
            />
            {input.trim() ? (
              <button
                onClick={sendMessage}
                disabled={loading}
                style={{
                  flexShrink: 0, height: 38, width: 38,
                  borderRadius: "50%",
                  backgroundColor: !loading ? "#00c805" : "rgba(0,200,5,0.18)",
                  color: !loading ? "#000" : "rgba(0,200,5,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none",
                  cursor: !loading ? "pointer" : "default",
                }}
              >
                <Send style={{ height: 15, width: 15 }} />
              </button>
            ) : (
              <button
                onClick={handleDismiss}
                aria-label="Close chat"
                style={{
                  flexShrink: 0, height: 38, width: 38,
                  borderRadius: "50%",
                  backgroundColor: "rgba(0,200,5,0.18)",
                  color: "#00c805",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <X style={{ height: 16, width: 16 }} />
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes aiCursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes graphShimmer {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </>,
    document.body
  );
}
