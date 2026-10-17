export type MarketHeatmapGroup = {
  id: string;
  label: string;
  icon: string;
  symbols: string[];
  /** Broad fund representing the selected market group, when available. */
  sectorFund?: { symbol: string; name: string };
  /** Treasury funds have no company market cap, so their relative AUM is fixed here. */
  staticWeights?: Record<string, number>;
};

export const MARKET_HEATMAP_GROUPS: MarketHeatmapGroup[] = [
  { id: "broad", label: "Broad", icon: "broad_tresury_icon.svg", symbols: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AVGO", "TSM", "BRK.B", "JPM"], sectorFund: { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" } },
  { id: "tech", label: "Tech", icon: "tech_icon.svg", symbols: ["NVDA", "AAPL", "MSFT", "GOOGL", "META", "AVGO", "ORCL", "CRM", "PLTR", "ADBE"], sectorFund: { symbol: "QQQ", name: "Invesco QQQ Trust" } },
  { id: "semiconductors", label: "Semiconductors", icon: "semiconductors_icon.svg", symbols: ["NVDA", "AVGO", "TSM", "AMD", "QCOM", "TXN", "INTC", "ASML"], sectorFund: { symbol: "SOXX", name: "iShares Semiconductor ETF" } },
  { id: "financials", label: "Financials", icon: "financials_icon.svg", symbols: ["JPM", "BAC", "WFC", "SCHW", "GS", "MS", "C", "BLK"], sectorFund: { symbol: "XLF", name: "Financial Select Sector SPDR Fund" } },
  { id: "energy", label: "Energy", icon: "energy_icon.svg", symbols: ["XOM", "CVX", "SHEL", "COP", "TTE", "EOG", "SLB"], sectorFund: { symbol: "XLE", name: "Energy Select Sector SPDR Fund" } },
  { id: "health-care", label: "Health Care", icon: "health_care_icon.svg", symbols: ["LLY", "JNJ", "ABBV", "UNH", "AZN", "PFE", "ABT", "MRK"], sectorFund: { symbol: "XLV", name: "Health Care Select Sector SPDR Fund" } },
  { id: "industrials", label: "Industrials", icon: "industrails_icon.svg", symbols: ["CAT", "UNP", "DE", "ETN", "HON", "GE", "BA"], sectorFund: { symbol: "XLI", name: "Industrial Select Sector SPDR Fund" } },
  { id: "consumer-discretionary", label: "Consumer Discr.", icon: "consumer_discr_icon.svg", symbols: ["AMZN", "TSLA", "HD", "MCD", "NKE", "BKNG"], sectorFund: { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund" } },
  { id: "consumer-staples", label: "Consumer Staples", icon: "consumer_staples_icon.svg", symbols: ["PG", "KO", "PEP", "WMT", "COST"], sectorFund: { symbol: "XLP", name: "Consumer Staples Select Sector SPDR Fund" } },
  { id: "materials", label: "Materials", icon: "materials_icon.svg", symbols: ["LIN", "SHW", "FCX", "ECL", "NEM"], sectorFund: { symbol: "XLB", name: "Materials Select Sector SPDR Fund" } },
  { id: "real-estate", label: "Real Estate", icon: "real_state_icon.svg", symbols: ["WELL", "PLD", "AMT", "EQIX", "SPG"], sectorFund: { symbol: "XLRE", name: "Real Estate Select Sector SPDR Fund" } },
  { id: "utilities", label: "Utilities", icon: "utilities_icon.svg", symbols: ["NEE", "SO", "DUK", "AEP", "EXC"], sectorFund: { symbol: "XLU", name: "Utilities Select Sector SPDR Fund" } },
  { id: "metals", label: "Metals", icon: "metals_icon.svg", symbols: ["FCX", "NEM", "SCCO", "GOLD"] },
  {
    id: "treasury-bonds",
    label: "Treasury Bonds",
    icon: "broad_tresury_icon.svg",
    symbols: ["TLT", "IEF", "SHY", "BIL", "TIP"],
    // Relative fund-size weights only; update these together whenever the
    // desired visual weighting needs refreshing.
    staticWeights: { TLT: 100, IEF: 52, SHY: 39, BIL: 35, TIP: 19 },
  },
];

export function getMarketHeatmapGroup(id: string | null): MarketHeatmapGroup | null {
  return MARKET_HEATMAP_GROUPS.find((group) => group.id === id) ?? null;
}
