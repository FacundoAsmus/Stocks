import "server-only";

import type {
  AnalystRecommendation,
  BasicFinancials,
  CandlePoint,
  ChartPeriod,
  CompanyNewsArticle,
  CompanyProfile,
  FinnhubQuote,
  PriceTarget,
  StockDetail,
  StockSummary,
  SymbolSearchResult
} from "@/types/stock";
import { MAJOR_INDICES } from "@/lib/constants";

const BASE_URL = "https://finnhub.io/api/v1";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const DEFAULT_CACHE_TTL_MS = 60_000;
const PROFILE_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const NEWS_CACHE_TTL_MS = 1000 * 60 * 10;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

class FinnhubError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "FinnhubError";
  }
}

function getApiKey() {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    throw new FinnhubError("Missing FINNHUB_API_KEY. Add it to .env.local and restart the dev server.");
  }

  return apiKey;
}

function cleanSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const aliases: Record<string, string> = {
    SPX: "^GSPC",
    "^SPX": "^GSPC",
    GSPC: "^GSPC",
    IXIC: "^IXIC",
    "^NASDAQ": "^IXIC",
    DJI: "^DJI",
    "^DJIA": "^DJI",
    DJIA: "^DJI"
  };

  return aliases[normalized] ?? normalized;
}

async function fetchYahooQuote(symbol: string): Promise<Partial<FinnhubQuote>> {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 MarketLens/1.0" },
    next: { revalidate: 30 }
  });

  if (!response.ok) return {};

  const payload = await response.json() as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
        };
      }>;
    };
  };

  const meta = payload.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return {};

  const price = meta.regularMarketPrice;
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const change = price - prev;

  return {
    c: price,
    pc: prev,
    d: change,
    dp: (change / prev) * 100,
    h: price,
    l: price,
    o: prev,
    t: Math.floor(Date.now() / 1000)
  };
}

function unixDaysAgo(days: number) {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

function yyyyMmDdDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function fetchFinnhub<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  ttlMs = DEFAULT_CACHE_TTL_MS
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });

  url.searchParams.set("token", apiKey);

  const cacheKey = url.toString().replace(apiKey, "API_KEY");
  const cached = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetch(url, {
    next: { revalidate: Math.floor(ttlMs / 1000) }
  });

  if (response.status === 429) {
    throw new FinnhubError("Finnhub rate limit reached. Please wait a minute and try again.", 429);
  }

  if (!response.ok) {
    throw new FinnhubError(`Finnhub request failed with status ${response.status}.`, response.status);
  }

  const value = (await response.json()) as T;
  memoryCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  const normalizedSymbol = cleanSymbol(symbol);

  const finnhubQuote = await fetchFinnhub<FinnhubQuote>(
    "/quote",
    { symbol: normalizedSymbol },
    30_000
  ).catch(() => ({} as FinnhubQuote));

  // If Finnhub returned a valid price, use it
  if (finnhubQuote.c && finnhubQuote.c > 0) return finnhubQuote;

  // Fallback to Yahoo for indices and unsupported symbols
  const yahooQuote = await fetchYahooQuote(normalizedSymbol).catch(() => ({}));
  return { ...finnhubQuote, ...yahooQuote } as FinnhubQuote;
}

export async function getCompanyProfile(symbol: string) {
  return fetchFinnhub<CompanyProfile>(
    "/stock/profile2",
    { symbol: cleanSymbol(symbol) },
    PROFILE_CACHE_TTL_MS
  );
}

export async function getBasicFinancials(symbol: string) {
  return fetchFinnhub<BasicFinancials>(
    "/stock/metric",
    { symbol: cleanSymbol(symbol), metric: "all" },
    1000 * 60 * 30
  );
}

export async function getCompanyNews(symbol: string) {
  return fetchFinnhub<CompanyNewsArticle[]>(
    "/company-news",
    {
      symbol: cleanSymbol(symbol),
      from: yyyyMmDdDaysAgo(21),
      to: yyyyMmDdDaysAgo(0)
    },
    NEWS_CACHE_TTL_MS
  );
}

export async function getAnalystRecommendations(symbol: string) {
  return fetchFinnhub<AnalystRecommendation[]>(
    "/stock/recommendation",
    { symbol: cleanSymbol(symbol) },
    1000 * 60 * 60
  );
}

export async function getPriceTarget(symbol: string) {
  return fetchFinnhub<PriceTarget>(
    "/stock/price-target",
    { symbol: cleanSymbol(symbol) },
    1000 * 60 * 60
  );
}

export async function searchSymbols(query: string) {
  if (!query.trim()) return [];
  const normalizedQuery = query.trim().toUpperCase();
  const indexMatches = MAJOR_INDICES.filter((index) => {
    const searchable = `${index.symbol} ${index.displaySymbol} ${index.description}`.toUpperCase();
    return searchable.includes(normalizedQuery);
  });

  const response = await fetchFinnhub<{ result?: SymbolSearchResult[] }>(
    "/search",
    { q: query.trim() },
    1000 * 60 * 10
  ).catch(() => ({ result: [] }));

  const stocks = (response.result ?? [])
    .filter((item) => item.type === "Common Stock" && /^[A-Z.^-]+$/.test(item.symbol))
    .slice(0, 8);

  const deduped = [...indexMatches, ...stocks].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.symbol === item.symbol) === index
  );

  return deduped.slice(0, 8);
}

function periodToDays(period: ChartPeriod) {
  switch (period) {
    case "1D": 
      return 2;
    case "1M":
      return 35;
    case "3M":
      return 100;
    case "6M":
      return 190;
    case "1Y":
      return 370;
  }
}

function periodToResolution(period: ChartPeriod): "60" | "D" | "W" {
  if (period === "1D") return "60";
  return period === "1Y" ? "W" : "D";
}

function periodToYahooRange(period: ChartPeriod) {
  switch (period) {
    case "1D": 
      return "1d";
    case "1M":
      return "1mo";
    case "3M":
      return "3mo";
    case "6M":
      return "6mo";
    case "1Y":
      return "1y";
  }
}

function periodToYahooInterval(period: ChartPeriod) {
  if (period === "1D") return "60m";
  return period === "1Y" ? "1wk" : "1d";
}

function toYahooSymbol(symbol: string) {
  const normalizedSymbol = cleanSymbol(symbol);
  const aliases: Record<string, string> = {
    "^IXIC": "^IXIC",
    "^GSPC": "^GSPC",
    "^DJI": "^DJI",
    "NDX": "^NDX",
    "BRK.B": "BRK-B"
  };

  return aliases[normalizedSymbol] ?? normalizedSymbol.replace(".", "-");
}

async function fetchYahooCandles(symbol: string, period: ChartPeriod): Promise<CandlePoint[]> {
  const yahooSymbol = toYahooSymbol(symbol);
  const url = new URL(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("range", periodToYahooRange(period));
  url.searchParams.set("interval", periodToYahooInterval(period));

  const cacheKey = `yahoo:${yahooSymbol}:${period}`;
  const cached = memoryCache.get(cacheKey) as CacheEntry<CandlePoint[]> | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 MarketLens/1.0"
    },
    next: { revalidate: 60 * 15 }
  });

  if (!response.ok) {
    throw new FinnhubError(`Historical fallback request failed with status ${response.status}.`, response.status);
  }

  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            open?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
      error?: { description?: string };
    };
  };

  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];

  if (!result?.timestamp?.length || !quote?.close?.length) {
    throw new FinnhubError(payload.chart?.error?.description ?? "Historical fallback returned no candles.");
  }

  const candles = result.timestamp
    .map((time, index) => {
      const close = quote.close?.[index];
      if (close === null || close === undefined) return null;

      return {
        close,
        high: quote.high?.[index] ?? undefined,
        low: quote.low?.[index] ?? undefined,
        open: quote.open?.[index] ?? undefined,
        time,
        volume: quote.volume?.[index] ?? undefined,
        date: new Date(time * 1000).toISOString().slice(0, 10)
      };
    })
    .filter((point): point is CandlePoint => Boolean(point));

  memoryCache.set(cacheKey, { value: candles, expiresAt: Date.now() + 1000 * 60 * 15 });
  return candles;
}

export async function getStockCandles(symbol: string, period: ChartPeriod = "3M") {
  const normalizedSymbol = cleanSymbol(symbol);
  const to = Math.floor(Date.now() / 1000);
  const from = unixDaysAgo(periodToDays(period));
  const resolution = periodToResolution(period);

  try {
    const response = await fetchFinnhub<{
      c?: number[];
      h?: number[];
      l?: number[];
      o?: number[];
      t?: number[];
      v?: number[];
      s: string;
    }>(
      "/stock/candle",
      { symbol: normalizedSymbol, resolution, from, to },
      1000 * 60 * 15
    );

    if (response.s === "ok" && response.c?.length && response.t?.length) {
      return response.c.map((close, index) => ({
        close,
        high: response.h?.[index],
        low: response.l?.[index],
        open: response.o?.[index],
        time: response.t?.[index] ?? 0,
        volume: response.v?.[index],
        date: new Date((response.t?.[index] ?? 0) * 1000).toISOString().slice(0, 10)
      }));
    }
  } catch (error) {
    const status = error instanceof FinnhubError ? error.status : undefined;
    const message = error instanceof Error ? error.message : "";
    const shouldFallback =
      status === 403 ||
      status === 429 ||
      message.includes("status 403") ||
      message.includes("status 429");

    if (!shouldFallback) {
      throw error;
    }
  }

  return fetchYahooCandles(normalizedSymbol, period);
}

export async function getCandles(symbol: string, resolution: "D" | "W", days: number) {
  const to = Math.floor(Date.now() / 1000);
  const from = unixDaysAgo(days);

  const response = await fetchFinnhub<{
    c?: number[];
    h?: number[];
    l?: number[];
    o?: number[];
    t?: number[];
    v?: number[];
    s: string;
  }>(
    "/stock/candle",
    { symbol: cleanSymbol(symbol), resolution, from, to },
    1000 * 60 * 15
  );

  if (response.s !== "ok" || !response.c || !response.t) return [];

  return response.c.map((close, index) => ({
    close,
    high: response.h?.[index],
    low: response.l?.[index],
    open: response.o?.[index],
    time: response.t?.[index] ?? 0,
    volume: response.v?.[index],
    date: new Date((response.t?.[index] ?? 0) * 1000).toISOString().slice(0, 10)
  }));
}

export async function getStockSummary(symbol: string): Promise<StockSummary> {
  const normalizedSymbol = cleanSymbol(symbol);
  const [quote, profile, sparkline] = await Promise.all([
    getQuote(normalizedSymbol),
    getCompanyProfile(normalizedSymbol).catch(() => ({} as CompanyProfile)),
    getStockCandles(normalizedSymbol, "1D").catch(() => [])
  ]);

  const fallbackSparkline: CandlePoint[] = [
    { date: "Previous", time: 0, close: quote.pc ?? 0 },
    { date: "Current", time: 1, close: quote.c ?? 0 }
  ].filter((point) => point.close > 0);

  return {
  symbol: normalizedSymbol,
  name: profile.name || normalizedSymbol,
  price: quote.c || null,
  change: quote.d,
  changePercent: quote.dp,
  sparkline: sparkline.length ? sparkline : fallbackSparkline,
  logo: profile.logo
  };
}

export async function getStockDetail(symbol: string): Promise<StockDetail> {
  const normalizedSymbol = cleanSymbol(symbol);
  const [quote, profile, financials, news, recommendations, priceTarget] = await Promise.all([
    getQuote(normalizedSymbol),
    getCompanyProfile(normalizedSymbol).catch(() => ({} as CompanyProfile)),
    getBasicFinancials(normalizedSymbol).catch(() => ({} as BasicFinancials)),
    getCompanyNews(normalizedSymbol).catch(() => []),
    getAnalystRecommendations(normalizedSymbol).catch(() => []),
    getPriceTarget(normalizedSymbol).catch(() => ({} as PriceTarget))
  ]);

  console.log("priceTarget:", JSON.stringify(priceTarget));

  console.log("peTTM:", financials?.metric?.peTTM);
  console.log("peNormalizedAnnual:", financials?.metric?.peNormalizedAnnual);
  console.log("epsTTM:", financials?.metric?.epsTTM);

  return {
    symbol: normalizedSymbol,
    quote,
    profile,
    financials,
    news: news.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
    priceTarget
  };
}

export async function getStockSummaries(symbols: string[]) {
  const uniqueSymbols = [...new Set(symbols.map(cleanSymbol).filter(Boolean))].slice(0, 20);
  const settled = await Promise.allSettled(uniqueSymbols.map((symbol) => getStockSummary(symbol)));

  return settled
    .filter((result): result is PromiseFulfilledResult<StockSummary> => result.status === "fulfilled")
    .map((result) => result.value);
}
