import { NextResponse } from "next/server";

// ── Fear & Greed Index — CNN-style multi-factor indicator ─────────────────
// Factors (all normalized 0-100, then averaged with weights):
//   1. VIX (^VIX)                — 30%  fear gauge: high VIX = fear
//   2. S&P 500 momentum          — 25%  125-day SMA vs current price
//   3. Market breadth            — 20%  gainers vs total on Yahoo movers
//   4. Safe-haven demand         — 15%  TLT vs SPY relative change
//   5. Junk-bond demand          — 10%  HYG vs LQD relative change

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_SCREENER = "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved";
const HEADERS = { "User-Agent": "Mozilla/5.0 MarketLens/1.0" };

interface YahooMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: YahooMeta;
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>;
      };
      timestamp?: number[];
    }>;
  };
}

async function fetchQuote(symbol: string): Promise<YahooMeta | null> {
  try {
    const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`);
    url.searchParams.set("range", "1d");
    url.searchParams.set("interval", "1d");
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
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
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as YahooChartResponse;
    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((v): v is number => typeof v === "number" && isFinite(v));
  } catch {
    return [];
  }
}

interface YahooScreenerResponse {
  finance?: {
    result?: Array<{
      quotes?: Array<{ symbol?: string }>;
    }>;
  };
}

async function fetchBreadth(): Promise<{ advancing: number; declining: number }> {
  async function count(kind: string) {
    try {
      const url = new URL(YAHOO_SCREENER);
      url.searchParams.set("scrIds", kind);
      url.searchParams.set("count", "25");
      const res = await fetch(url, {
        headers: HEADERS,
        next: { revalidate: 120 },
        signal: AbortSignal.timeout(5000),
      });
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

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

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
  const spread = tltChange - spyChange;
  return clamp(50 - spread * 16.67);
}

function junkBondScore(hygChange: number, lqdChange: number): number {
  const spread = hygChange - lqdChange;
  return clamp(50 + spread * 16.67);
}

function pctChange(meta: YahooMeta | null): number {
  if (!meta?.regularMarketPrice) return 0;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
  return ((meta.regularMarketPrice - prev) / prev) * 100;
}

function labelForScore(score: number) {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

export async function GET() {
  const [vixMeta, spyMeta, tltMeta, hygMeta, lqdMeta, spyCloses, breadthData] =
    await Promise.all([
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
    vix:       { score: vixToScore(vix),                                              weight: 0.30, label: "VIX Volatility",    value: `VIX ${vix.toFixed(2)}` },
    momentum:  { score: momentumScore(spyCloses),                                     weight: 0.25, label: "Market Momentum",    value: `SPY ${spyPct >= 0 ? "+" : ""}${spyPct.toFixed(2)}%` },
    breadth:   { score: breadthScore(breadthData.advancing, breadthData.declining),   weight: 0.20, label: "Market Breadth",     value: `${breadthData.advancing} adv / ${breadthData.declining} decl` },
    safeHaven: { score: safeHavenScore(spyPct, tltPct),                              weight: 0.15, label: "Safe-Haven Demand",  value: `TLT ${tltPct >= 0 ? "+" : ""}${tltPct.toFixed(2)}%` },
    junkBond:  { score: junkBondScore(hygPct, lqdPct),                               weight: 0.10, label: "Junk Bond Demand",   value: `HYG ${hygPct >= 0 ? "+" : ""}${hygPct.toFixed(2)}%` },
  };

  const composite = Math.round(
    Object.values(factors).reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  return NextResponse.json({
    score: composite,
    label: labelForScore(composite),
    factors: Object.fromEntries(
      Object.entries(factors).map(([k, f]) => [k, { score: Math.round(f.score), label: f.label, value: f.value }])
    ),
  });
}
