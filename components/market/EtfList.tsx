"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type EtfEntry = {
  symbol: string;
  name: string;
  sector: string;
};

// Major sector ETFs — one per sector
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

// ─── Web version: horizontal scrollable pill row ─────────────────────────
export function EtfRow() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
      {SECTOR_ETFS.map((etf) => (
        <Link
          key={etf.symbol}
          href={`/stock/${etf.symbol}`}
          className="flex flex-col shrink-0 rounded-lg border border-border-subtle bg-panel px-4 py-3 hover:border-positive/50 hover:bg-panel-muted transition-all duration-150 min-w-[110px]"
        >
          <span className="text-[10px] font-medium text-text-muted mb-0.5 truncate">{etf.sector}</span>
          <span className="text-sm font-bold text-text-primary">{etf.symbol}</span>
          <span className="text-[10px] text-text-muted truncate">{etf.name}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── Mobile version: list rows ───────────────────────────────────────────
export function EtfMobileList() {
  return (
    <div className="mx-4 rounded-xl border border-border-subtle bg-panel overflow-hidden">
      {SECTOR_ETFS.map((etf, i) => (
        <Link
          key={etf.symbol}
          href={`/stock/${etf.symbol}`}
          className={cn(
            "flex items-center justify-between px-4 py-3 active:bg-panel-muted",
            i !== SECTOR_ETFS.length - 1 && "border-b border-border-subtle/40"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-[10px] font-bold text-text-primary shrink-0">
              {etf.symbol.slice(0, 2)}
            </span>
            <div>
              <span className="block text-sm font-bold text-text-primary">{etf.symbol}</span>
              <span className="block text-xs text-text-muted truncate">{etf.name}</span>
            </div>
          </div>
          <span className="text-xs font-medium text-positive border border-positive/30 rounded-full px-2 py-0.5 shrink-0 ml-2">
            {etf.sector}
          </span>
        </Link>
      ))}
    </div>
  );
}
