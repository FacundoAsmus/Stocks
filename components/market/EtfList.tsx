"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import type { StockSummary } from "@/types/stock";

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

function MiniSparkline({ stock, height = 32 }: { stock: StockSummary; height?: number }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const data = stock.sparkline?.length
    ? stock.sparkline
    : [
        { time: 0, close: (stock.price ?? 0) - (stock.change ?? 0) },
        { time: 1, close: stock.price ?? 0 },
      ];
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="monotone"
            dataKey="close"
            stroke={isPos ? "#00c805" : "#ff3003"}
            fill={isPos ? "rgba(0,200,5,0.08)" : "rgba(255,48,3,0.08)"}
            strokeWidth={1.5}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Web version: horizontal scrollable cards with sparkline + % ──────────
export function EtfRow({ etfs }: { etfs: StockSummary[] }) {
  const etfMap = new Map(etfs.map(e => [e.symbol, e]));

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
      {SECTOR_ETFS.map((etf) => {
        const stock = etfMap.get(etf.symbol);
        const isPos = (stock?.changePercent ?? 0) >= 0;
        return (
          <Link
            key={etf.symbol}
            href={`/stock/${etf.symbol}`}
            className="flex flex-col shrink-0 rounded-lg border border-border-subtle bg-panel px-3 py-3 hover:border-positive/50 hover:bg-panel-muted transition-all duration-150 min-w-[120px] gap-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-text-primary">{etf.symbol}</span>
              {stock && (
                <span className={cn("text-xs font-bold", isPos ? "text-positive" : "text-negative")}>
                  {formatPercent(stock.changePercent)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-muted truncate">{etf.name}</span>
            {stock && (
              <div className="mt-1 w-full">
                <MiniSparkline stock={stock} height={28} />
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ─── Mobile version: list rows with sparkline + % ────────────────────────
export function EtfMobileList({ etfs }: { etfs: StockSummary[] }) {
  const etfMap = new Map(etfs.map(e => [e.symbol, e]));

  return (
    <div className="mx-4 rounded-xl border border-border-subtle bg-panel overflow-hidden">
      {SECTOR_ETFS.map((etf, i) => {
        const stock = etfMap.get(etf.symbol);
        const isPos = (stock?.changePercent ?? 0) >= 0;
        return (
          <Link
            key={etf.symbol}
            href={`/stock/${etf.symbol}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 active:bg-panel-muted",
              i !== SECTOR_ETFS.length - 1 && "border-b border-border-subtle/40"
            )}
          >
            {/* Symbol + name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="h-8 w-8 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-[10px] font-bold text-text-primary shrink-0">
                {etf.symbol.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-text-primary">{etf.symbol}</span>
                <span className="block text-xs text-text-muted truncate">{etf.name}</span>
              </div>
            </div>

            {/* Sparkline */}
            {stock && (
              <div className="w-16 shrink-0">
                <MiniSparkline stock={stock} height={32} />
              </div>
            )}

            {/* % badge */}
            {stock && (
              <span className={cn(
                "text-sm font-bold text-black shrink-0 px-3 py-1 rounded-lg min-w-[52px] text-center",
                isPos ? "bg-positive" : "bg-negative"
              )}>
                {formatPercent(stock.changePercent)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
