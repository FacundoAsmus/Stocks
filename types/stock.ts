export interface FinnhubQuote {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface CompanyProfile {
  country?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number;
  name?: string;
  phone?: string;
  shareOutstanding?: number;
  ticker?: string;
  weburl?: string;
}

export interface BasicFinancials {
  metric?: Record<string, number | string | null>;
  series?: Record<string, unknown>;
  metricType?: string;
  symbol?: string;
}

export interface CompanyNewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface AnalystRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export interface PriceTarget {
  lastUpdated?: string;
  symbol?: string;
  targetHigh?: number;
  targetLow?: number;
  targetMean?: number;
  targetMedian?: number;
}

export interface CandlePoint {
  date: string;
  time: number;
  close: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
}

export interface StockSummary {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: CandlePoint[];
  logo?: string;
}

export interface StockDetail {
  symbol: string;
  quote: FinnhubQuote;
  profile: CompanyProfile;
  financials: BasicFinancials;
  news: CompanyNewsArticle[];
  recommendations: AnalystRecommendation[];
  priceTarget: PriceTarget;
}

export interface SymbolSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export type ChartPeriod = "1D" | "1M" | "3M" | "6M" | "1Y";
