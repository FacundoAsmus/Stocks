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
};

export const SECTOR_ETFS: EtfEntry[] = [
  { symbol: "SPY",  name: "S&P 500",         sector: "Main Market" },
  { symbol: "QQQ",  name: "Nasdaq 100",       sector: "Technology" },
  { symbol: "SOXX", name: "Semiconductors",   sector: "Semis" },
  { symbol: "XLF",  name: "Financials",       sector: "Finance" },
  { symbol: "XLE",  name: "Energy",           sector: "Energy" },
  { symbol: "XLV",  name: "Health Care",      sector: "Healthcare" },
  { symbol: "XLI",  name: "Industrials",      sector: "Industrials" },
  { symbol: "XLY",  name: "Consumer Discr.",  sector: "Consumer" },
  { symbol: "XLP",  name: "Consumer Staples", sector: "Staples" },
  { symbol: "XLB",  name: "Materials",        sector: "Materials" },
  { symbol: "XLRE", name: "Real Estate",      sector: "Real Estate" },
  { symbol: "XLU",  name: "Utilities",        sector: "Utilities" },
  { symbol: "GLD",  name: "Gold",             sector: "Commodities" },
  { symbol: "IEF",  name: "7-10yr Treasury",  sector: "Bonds" },
  { symbol: "DIA",  name: "Dow Jones",        sector: "Dow" },
];
