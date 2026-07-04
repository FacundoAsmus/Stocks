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
  const yesterdayClose = (stock.price ?? 0) - (stock.change ?? 0);
  const data = stock.sparkline?.length
    ? [{ time: 0, close: yesterdayClose }, ...stock.sparkline]
    : [
        { time: 0, close: yesterdayClose },
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

// ─── Web version: table-style list spanning full width ───────────────────
export function EtfRow({ etfs }: { etfs: StockSummary[] }) {
  const etfMap = new Map(etfs.map(e => [e.symbol, e]));

  return (
    <div className="rounded-lg border border-border-subtle bg-black p-2 shadow-2xl shadow-black/20 overflow-visible">
      {SECTOR_ETFS.map((etf) => {
        const stock = etfMap.get(etf.symbol);
        const isPos = (stock?.changePercent ?? 0) >= 0;
        return (
          <div
            key={etf.symbol}
            className="group grid grid-cols-[34px_minmax(80px,0.8fr)_minmax(80px,0.8fr)_minmax(120px,1.5fr)_minmax(92px,auto)] items-center gap-3 rounded-md border border-transparent border-b-border-subtle/70 px-4 py-3 transition-all duration-200 hover:-translate-y-1 hover:border-positive/50 hover:bg-panel-muted/75 hover:shadow-2xl hover:shadow-black/25 hover:z-10 relative"
          >
            <Link href={`/stock/${etf.symbol}`} aria-label={`Open ${etf.symbol}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-[10px] font-bold text-text-primary">
                {etf.symbol.slice(0, 2)}
              </span>
            </Link>
            <Link href={`/stock/${etf.symbol}`} className="min-w-0">
              <span className="block truncate text-xs font-bold text-text-primary">{etf.symbol}</span>
              <span className="block text-xs text-text-muted truncate">{etf.sector}</span>
            </Link>
            <Link href={`/stock/${etf.symbol}`} className="min-w-0">
              <span className="block text-xs text-text-muted truncate">{etf.name}</span>
            </Link>
            <Link href={`/stock/${etf.symbol}`} aria-label={`Open ${etf.symbol}`}>
              {stock
                ? <MiniSparkline stock={stock} height={32} />
                : <span className="block h-8 w-full rounded bg-panel-muted/40" />
              }
            </Link>
            <Link
              href={`/stock/${etf.symbol}`}
              className={cn(
                "min-w-[92px] rounded-md border px-2 py-2 text-center text-xs font-bold !text-black",
                isPos ? "border-positive/40 bg-positive" : "border-negative/60 bg-negative"
              )}
            >
              {stock ? formatPercent(stock.changePercent) : "—"}
            </Link>
          </div>
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
