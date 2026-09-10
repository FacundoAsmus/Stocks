export type MarketHeatmapGroup = {
  id: string;
  label: string;
  symbols: string[];
  /** Treasury funds have no company market cap, so their relative AUM is fixed here. */
  staticWeights?: Record<string, number>;
};

export const MARKET_HEATMAP_GROUPS: MarketHeatmapGroup[] = [
  { id: "broad", label: "Broad", symbols: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AVGO", "TSM", "BRK.B", "JPM"] },
  { id: "tech", label: "Tech", symbols: ["NVDA", "AAPL", "MSFT", "GOOGL", "META", "AVGO", "ORCL", "CRM", "PLTR", "ADBE"] },
  { id: "semiconductors", label: "Semiconductors", symbols: ["NVDA", "AVGO", "TSM", "AMD", "QCOM", "TXN", "INTC", "ASML"] },
  { id: "financials", label: "Financials", symbols: ["JPM", "BAC", "WFC", "SCHW", "GS", "MS", "C", "BLK"] },
  { id: "energy", label: "Energy", symbols: ["XOM", "CVX", "SHEL", "COP", "TTE", "EOG", "SLB"] },
  { id: "health-care", label: "Health Care", symbols: ["LLY", "JNJ", "ABBV", "UNH", "AZN", "PFE", "ABT", "MRK"] },
  { id: "industrials", label: "Industrials", symbols: ["CAT", "UNP", "DE", "ETN", "HON", "GE", "BA"] },
  { id: "consumer-discretionary", label: "Consumer Discr.", symbols: ["AMZN", "TSLA", "HD", "MCD", "NKE", "BKNG"] },
  { id: "consumer-staples", label: "Consumer Staples", symbols: ["PG", "KO", "PEP", "WMT", "COST"] },
  { id: "materials", label: "Materials", symbols: ["LIN", "SHW", "FCX", "ECL", "NEM"] },
  { id: "real-estate", label: "Real Estate", symbols: ["WELL", "PLD", "AMT", "EQIX", "SPG"] },
  { id: "utilities", label: "Utilities", symbols: ["NEE", "SO", "DUK", "AEP", "EXC"] },
  { id: "metals", label: "Metals", symbols: ["FCX", "NEM", "SCCO", "GOLD"] },
  {
    id: "treasury-bonds",
    label: "Treasury Bonds",
    symbols: ["TLT", "IEF", "SHY", "BIL", "TIP"],
    // Relative fund-size weights only; update these together whenever the
    // desired visual weighting needs refreshing.
    staticWeights: { TLT: 100, IEF: 52, SHY: 39, BIL: 35, TIP: 19 },
  },
];

export function getMarketHeatmapGroup(id: string | null): MarketHeatmapGroup | null {
  return MARKET_HEATMAP_GROUPS.find((group) => group.id === id) ?? null;
}
