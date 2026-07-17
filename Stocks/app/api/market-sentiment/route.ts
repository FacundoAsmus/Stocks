import { NextResponse } from "next/server";

// ── Fear & Greed Index — CNN-style multi-factor indicator ─────────────────
// Factors (all normalized 0-100, then averaged with weights):
//   1. VIX vs its own 50-day average — 30%  (relative, not absolute — a VIX
//      of 15 during a calm stretch reads very differently than a VIX of 15
//      right after a spike; CNN's real volatility factor is relative too)
//   2. S&P 500 momentum               — 25%  self-normalized z-score of the
//      "price vs 125-day SMA" deviation against its own trailing distribution,
//      instead of one arbitrary fixed multiplier that skews greedy in any
//      ordinary uptrend
//   3. Sector breadth                 — 20%  how many of the 11 S&P sector
//      ETFs are up vs down today
//   4. Safe-haven demand              — 15%  TLT vs SPY relative change
//   5. Junk-bond demand               — 10%  HYG vs LQD relative change

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const HEADERS = { "User-Agent": "Mozilla/5.0 MarketLens/1.0" };

// The 11 SPDR sector ETFs — a lightweight, reliable proxy for "how much of
// the market is participating today" without needing a full constituent feed.
const SECTOR_ETFS = ["XLK", "XLF", "XLV", "XLE", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC"];

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

async function fetchCloses(symbol: string, range: string): Promise<number[]> {
  try {
    const url = new URL(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`);
    url.searchParams.set("range", range);
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

async function fetchSectorBreadth(): Promise<{ advancing: number; declining: number }> {
  const metas = await Promise.all(SECTOR_ETFS.map(fetchQuote));
  let advancing = 0;
  let declining = 0;
  metas.forEach((meta) => {
    const pct = pctChange(meta);
    if (pct > 0) advancing++;
    else if (pct < 0) declining++;
  });
  return { advancing, declining };
}

function clamp(v: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, v));
}

// VIX relative to its own trailing 50-day average — a VIX that's climbing
// away from its recent norm signals fear; one that's settled below its
// recent norm signals calm, regardless of the absolute level.
function vixToScore(currentVix: number, vixCloses: number[]): number {
  const window = vixCloses.slice(-50);
  if (window.length < 10) {
    // Not enough history — fall back to a coarse absolute read rather than a
    // hard-coded curve that assumes a specific "normal" VIX level.
    return clamp(((25 - currentVix) / 20) * 100 + 50, 0, 100);
  }
  const sma50 = window.reduce((a, b) => a + b, 0) / window.length;
  const deviationPct = ((currentVix - sma50) / sma50) * 100;
  return clamp(50 - deviationPct * 3);
}

// Self-normalizing momentum: instead of an arbitrary fixed multiplier on
// "% above the 125-day SMA" (which reads as "Greed" in almost any ordinary
// uptrend), build the recent distribution of that deviation and score today
// as a z-score against its own history.
function momentumScore(closes: number[]): number {
  const SMA_WINDOW = 125;
  if (closes.length < SMA_WINDOW + 20) return 50;

  const deviations: number[] = [];
  for (let i = SMA_WINDOW; i < closes.length; i++) {
    const window = closes.slice(i - SMA_WINDOW, i);
    const sma = window.reduce((a, b) => a + b, 0) / SMA_WINDOW;
    deviations.push(((closes[i] - sma) / sma) * 100);
  }
  if (deviations.length < 20) return 50;

  const current = deviations[deviations.length - 1];
  const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const variance = deviations.reduce((a, b) => a + (b - mean) ** 2, 0) / deviations.length;
  const std = Math.sqrt(variance) || 1;
  const z = (current - mean) / std;
  return clamp(50 + z * 15);
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
  const [vixMeta, spyMeta, tltMeta, hygMeta, lqdMeta, spyCloses, vixCloses, breadthData] =
    await Promise.all([
      fetchQuote("%5EVIX"),
      fetchQuote("SPY"),
      fetchQuote("TLT"),
      fetchQuote("HYG"),
      fetchQuote("LQD"),
      fetchCloses("SPY", "1y"),
      fetchCloses("%5EVIX", "3mo"),
      fetchSectorBreadth(),
    ]);

  const vix = vixMeta?.regularMarketPrice ?? 20;
  const spyPct = pctChange(spyMeta);
  const tltPct = pctChange(tltMeta);
  const hygPct = pctChange(hygMeta);
  const lqdPct = pctChange(lqdMeta);

  const factors = {
    vix:       { score: vixToScore(vix, vixCloses),                                    weight: 0.30, label: "VIX Volatility",    value: `VIX ${vix.toFixed(2)}` },
    momentum:  { score: momentumScore(spyCloses),                                     weight: 0.25, label: "Market Momentum",    value: `SPY ${spyPct >= 0 ? "+" : ""}${spyPct.toFixed(2)}%` },
    breadth:   { score: breadthScore(breadthData.advancing, breadthData.declining),   weight: 0.20, label: "Sector Breadth",     value: `${breadthData.advancing}/${breadthData.advancing + breadthData.declining} sectors up` },
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
