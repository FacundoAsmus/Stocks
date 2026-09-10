// Plain data, deliberately NOT in a "use client" file. components/market/EtfList.tsx
// (which IS "use client") re-exports these for its own consumers, but any
// Server Component — e.g. components/DesktopStockDetail.tsx — must import
// straight from here instead. Importing a plain value (as opposed to a
// component) from a "use client" module into a Server Component doesn't
// give you the real value on the server; it resolves to a client-reference
// stub, which is why `.some is not a function` showed up there.
export type EtfEntry = {
  symbol: string;
  name: string;
  sector: string;
  /** Hand-written copy so ETF pages never depend on an SEC company filing. */
  description: string;
};

export const SECTOR_ETFS: EtfEntry[] = [
  { symbol: "SPY",  name: "S&P 500",         sector: "Main Market", description: "SPY seeks to track the S&P 500, a benchmark of large U.S. companies. It provides broad exposure to the U.S. equity market across multiple sectors." },
  { symbol: "QQQ",  name: "Nasdaq 100",       sector: "Technology", description: "QQQ seeks to track the Nasdaq-100 Index, which includes 100 of the largest non-financial companies listed on Nasdaq. Its holdings have a meaningful tilt toward technology and growth-oriented businesses." },
  { symbol: "SOXX", name: "Semiconductors",   sector: "Semis", description: "SOXX provides focused exposure to companies involved in the semiconductor industry. Its portfolio spans chip designers, manufacturers, equipment makers, and related businesses." },
  { symbol: "XLF",  name: "Financials",       sector: "Finance", description: "XLF provides exposure to the financial sector of the S&P 500. Its holdings include banks, insurers, capital-markets firms, consumer-finance companies, and financial technology businesses." },
  { symbol: "XLE",  name: "Energy",           sector: "Energy", description: "XLE provides exposure to the energy sector of the S&P 500. It includes companies involved in oil, natural gas, energy equipment, and related services." },
  { symbol: "XLV",  name: "Health Care",      sector: "Healthcare", description: "XLV provides exposure to the health care sector of the S&P 500. Its holdings span pharmaceuticals, biotechnology, health-care equipment, providers, and life-sciences tools." },
  { symbol: "XLI",  name: "Industrials",      sector: "Industrials", description: "XLI provides exposure to the industrial sector of the S&P 500. It includes aerospace and defense, transportation, machinery, commercial services, and construction-related companies." },
  { symbol: "XLY",  name: "Consumer Discr.",  sector: "Consumer", description: "XLY provides exposure to consumer discretionary companies in the S&P 500. The fund includes retailers, automakers, consumer services, leisure businesses, and selected media companies." },
  { symbol: "XLP",  name: "Consumer Staples", sector: "Staples", description: "XLP provides exposure to consumer staples companies in the S&P 500. Its holdings include food, beverage, household-products, tobacco, and staple retail businesses." },
  { symbol: "XLB",  name: "Materials",        sector: "Materials", description: "XLB provides exposure to the materials sector of the S&P 500. It includes chemical, metals and mining, construction-materials, packaging, and paper and forest-products companies." },
  { symbol: "XLRE", name: "Real Estate",      sector: "Real Estate", description: "XLRE provides exposure to the real-estate sector of the S&P 500. Its holdings primarily include real-estate investment trusts and other publicly traded real-estate companies." },
  { symbol: "XLU",  name: "Utilities",        sector: "Utilities", description: "XLU provides exposure to the utilities sector of the S&P 500. It includes companies involved in electric power, natural gas, water, and other regulated utility services." },
  { symbol: "GLD",  name: "Gold",             sector: "Commodities", description: "GLD is designed to reflect the performance of gold bullion, less fund expenses. It offers market participants a way to gain exposure to the price movement of physical gold without directly storing it." },
  { symbol: "IEF",  name: "7-10yr Treasury",  sector: "Bonds", description: "IEF provides exposure to U.S. Treasury bonds with remaining maturities generally between seven and ten years. Its value is influenced by Treasury yields, interest-rate expectations, and bond-market conditions." },
  { symbol: "DIA",  name: "Dow Jones",        sector: "Dow", description: "DIA seeks to track the Dow Jones Industrial Average, a price-weighted index of 30 large U.S. companies. It provides concentrated exposure to established companies across major industries." },
];

const ETF_DESCRIPTION_BY_SYMBOL = new Map(
  SECTOR_ETFS.map((etf) => [etf.symbol, etf.description]),
);

export function getEtfDescription(symbol: string): string | null {
  return ETF_DESCRIPTION_BY_SYMBOL.get(symbol.trim().toUpperCase()) ?? null;
}
