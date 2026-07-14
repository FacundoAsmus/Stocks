import { NextResponse } from "next/server";

// ── Fear & Greed Index ─────────────────────────────────────────────────────
// This used to be a home-grown 5-factor approximation of CNN's index (VIX
// level, SPY vs its 125-day SMA, a couple of Yahoo screener proxies, etc),
// each combined with hand-picked scaling constants. CNN's real methodology
// normalizes each of its 7 factors against their own historical
// distribution in a way that isn't published, so that approximation could
// (and did) land tens of points away from CNN's actual number.
//
// To guarantee this always matches CNN's own site, we now pull CNN's own
// computed score directly from the same public endpoint their website
// itself calls. If that's ever unreachable, we fall back to the old rough
// proxy so the section still shows *something* rather than erroring out.

const CNN_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const CNN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "application/json",
};

interface CnnSeriesPoint { x: number; y: number; rating?: string }
interface CnnSubIndicator {
  score?: number;
  rating?: string;
  data?: CnnSeriesPoint[];
}
interface CnnResponse {
  fear_and_greed?: CnnSubIndicator;
  fear_and_greed_historical?: { data?: CnnSeriesPoint[] };
  market_momentum_sp500?: CnnSubIndicator;
  stock_price_strength?: CnnSubIndicator;
  stock_price_breadth?: CnnSubIndicator;
  put_call_options?: CnnSubIndicator;
  market_volatility_vix?: CnnSubIndicator;
  safe_haven_demand?: CnnSubIndicator;
  junk_bond_demand?: CnnSubIndicator;
}

function labelForScore(score: number) {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

function titleCase(rating?: string) {
  if (!rating) return undefined;
  return rating.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchCnn(): Promise<CnnResponse | null> {
  try {
    const res = await fetch(CNN_URL, {
      headers: CNN_HEADERS,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CnnResponse;
  } catch {
    return null;
  }
}

function subFactor(sub: CnnSubIndicator | undefined, label: string) {
  if (!sub) return null;
  const latest = sub.data?.length ? sub.data[sub.data.length - 1] : undefined;
  const score = typeof sub.score === "number" ? sub.score : latest?.y;
  if (typeof score !== "number") return null;
  const rating = sub.rating ?? latest?.rating;
  return {
    score: Math.round(score),
    label,
    value: titleCase(rating) ?? labelForScore(score),
  };
}

// ── Fallback proxy (only used if CNN's endpoint is unreachable) ───────────
const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_SCREENER = "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved";
const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0 MarketLens/1.0" };

interface YahooMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
}
interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: YahooMeta;
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
}

async function fetchQuote(symbol: string): Promise<YahooMeta | null> {
  try {
    const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`);
    url.searchParams.set("range", "1d");
    url.searchParams.set("interval", "1d");
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChartResponse;
    return data.chart?.result?.[0]?.meta ?? null;
  } catch {
    return null;
  }
}

async function fetchCloses(symbol: string): Promise<number[]> {
  try {
    const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`);
    url.searchParams.set("range", "6mo");
    url.searchParams.set("interval", "1d");
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = (await res.json()) as YahooChartResponse;
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((v): v is number => typeof v === "number" && isFinite(v));
  } catch {
    return [];
  }
}

interface YahooScreenerResponse {
  finance?: { result?: Array<{ quotes?: Array<{ symbol?: string }> }> };
}

async function fetchBreadth(): Promise<{ advancing: number; declining: number }> {
  async function count(kind: string) {
    try {
      const url = new URL(YAHOO_SCREENER);
      url.searchParams.set("scrIds", kind);
      url.searchParams.set("count", "25");
      const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 120 }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return 0;
      const data = (await res.json()) as YahooScreenerResponse;
      return data.finance?.result?.[0]?.quotes?.length ?? 0;
    } catch {
      return 0;
    }
  }
  const [advancing, declining] = await Promise.all([count("day_gainers"), count("day_losers")]);
  return { advancing, declining };
}

function clamp(v: number, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }
function vixToScore(vix: number): number {
  if (vix <= 12) return 100;
  if (vix >= 40) return 0;
  return clamp(((40 - vix) / 28) * 100);
}
function momentumScore(closes: number[]): number {
  if (closes.length < 10) return 50;
  const current = closes[closes.length - 1];
  const window = closes.slice(-125);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const pctAbove = ((current - sma) / sma) * 100;
  return clamp(50 + pctAbove * 5);
}
function breadthScore(advancing: number, declining: number): number {
  const total = advancing + declining;
  if (!total) return 50;
  return clamp((advancing / total) * 100);
}
function safeHavenScore(spyChange: number, tltChange: number): number {
  return clamp(50 - (tltChange - spyChange) * 16.67);
}
function junkBondScore(hygChange: number, lqdChange: number): number {
  return clamp(50 + (hygChange - lqdChange) * 16.67);
}
function pctChange(meta: YahooMeta | null): number {
  if (!meta?.regularMarketPrice) return 0;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
  return ((meta.regularMarketPrice - prev) / prev) * 100;
}

async function fallbackSentiment() {
  const [vixMeta, spyMeta, tltMeta, hygMeta, lqdMeta, spyCloses, breadthData] = await Promise.all([
    fetchQuote("%5EVIX"),
    fetchQuote("SPY"),
    fetchQuote("TLT"),
    fetchQuote("HYG"),
    fetchQuote("LQD"),
    fetchCloses("SPY"),
    fetchBreadth(),
  ]);

  const vix = vixMeta?.regularMarketPrice ?? 20;
  const spyPct = pctChange(spyMeta);
  const tltPct = pctChange(tltMeta);
  const hygPct = pctChange(hygMeta);
  const lqdPct = pctChange(lqdMeta);

  const factors = {
    vix:       { score: vixToScore(vix),                                            weight: 0.30, label: "VIX Volatility",   value: `VIX ${vix.toFixed(2)}` },
    momentum:  { score: momentumScore(spyCloses),                                   weight: 0.25, label: "Market Momentum",  value: `SPY ${spyPct >= 0 ? "+" : ""}${spyPct.toFixed(2)}%` },
    breadth:   { score: breadthScore(breadthData.advancing, breadthData.declining), weight: 0.20, label: "Market Breadth",   value: `${breadthData.advancing} adv / ${breadthData.declining} decl` },
    safeHaven: { score: safeHavenScore(spyPct, tltPct),                             weight: 0.15, label: "Safe-Haven Demand", value: `TLT ${tltPct >= 0 ? "+" : ""}${tltPct.toFixed(2)}%` },
    junkBond:  { score: junkBondScore(hygPct, lqdPct),                              weight: 0.10, label: "Junk Bond Demand", value: `HYG ${hygPct >= 0 ? "+" : ""}${hygPct.toFixed(2)}%` },
  };

  const composite = Math.round(Object.values(factors).reduce((sum, f) => sum + f.score * f.weight, 0));

  return {
    score: composite,
    label: labelForScore(composite),
    factors: Object.fromEntries(
      Object.entries(factors).map(([k, f]) => [k, { score: Math.round(f.score), label: f.label, value: f.value }])
    ),
    source: "fallback" as const,
  };
}

export async function GET() {
  const cnn = await fetchCnn();

  // The current score CNN itself displays. Fall back to the most recent
  // point of the historical series if the direct snapshot field is missing.
  const historical = cnn?.fear_and_greed_historical?.data;
  const liveScore = cnn?.fear_and_greed?.score ?? historical?.[historical.length - 1]?.y;

  if (typeof liveScore === "number" && isFinite(liveScore)) {
    const score = Math.round(liveScore);
    const factors = {
      momentum:  subFactor(cnn?.market_momentum_sp500, "Market Momentum"),
      strength:  subFactor(cnn?.stock_price_strength,  "Price Strength"),
      breadth:   subFactor(cnn?.stock_price_breadth,   "Market Breadth"),
      putCall:   subFactor(cnn?.put_call_options,      "Put/Call Options"),
      vix:       subFactor(cnn?.market_volatility_vix, "VIX Volatility"),
      safeHaven: subFactor(cnn?.safe_haven_demand,     "Safe-Haven Demand"),
      junkBond:  subFactor(cnn?.junk_bond_demand,      "Junk Bond Demand"),
    };
    return NextResponse.json({
      score,
      label: titleCase(cnn?.fear_and_greed?.rating) ?? labelForScore(score),
      factors: Object.fromEntries(Object.entries(factors).filter(([, v]) => v !== null)),
      source: "cnn",
    });
  }

  return NextResponse.json(await fallbackSentiment());
}
