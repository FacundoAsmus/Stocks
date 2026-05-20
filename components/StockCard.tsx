"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { StockSummary } from "@/types/stock";
import { AddToWatchlistButton } from "./AddToWatchlistButton";

export function StockCard({ stock }: { stock: StockSummary }) {
  const isPositive = (stock.changePercent ?? 0) >= 0;
  
  // 1. Calculate yesterday's close price to act as our true visual baseline
  const currentPrice = stock.price ?? 0;
  const yesterdayClose = currentPrice - (stock.change ?? 0);

  // 2. Inject yesterday's close as the first item in the array if it exists
  const adjustedSparkline = stock.sparkline && stock.sparkline.length > 0
    ? [{ close: yesterdayClose, time: 0 }, ...stock.sparkline]
    : [];

  const hasSparkline = adjustedSparkline.length > 1;
  const sparklinePositive = isPositive;
  
  const gradientId = `spark-${stock.symbol.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <article className="group relative flex flex-col min-h-[260px] sm:min-h-[440px] w-full rounded-2xl sm:rounded-[32px] border border-border-subtle bg-panel transition-all duration-300 ease-out hover:border-accent/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-2 hover:scale-[1.02]">
      <div className="absolute right-8 top-8 z-30">
        <AddToWatchlistButton symbol={stock.symbol} name={stock.name} compact />
      </div>

      {/* 2. The Link: It now handles the padding (p-8) and expands to fill the entire article shape */}
      <Link 
        href={`/stock/${stock.symbol}`}
        className="z-10 flex flex-1 flex-col p-4 sm:p-8 rounded-2xl sm:rounded-[32px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Header and Financials */}
          {/* Header and Financials */}
          <div className="flex flex-col gap-1 sm:gap-2">
          <div className="min-w-0 flex items-center gap-2 sm:gap-3">
            {stock.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stock.logo}
                alt=""
                className="h-8 w-8 sm:h-12 sm:w-12 rounded-md border border-white/10 bg-white/5 object-contain shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs sm:text-sm font-semibold text-text-primary">
                {stock.symbol.replace("^", "").slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-text-primary truncate">{stock.symbol}</h2>
              <p className="text-xs sm:text-sm font-medium text-text-muted truncate">{stock.name}</p>
            </div>
          </div>

          <div className="flex items-start justify-between mt-2 sm:mt-0">
            <div>
              <p className="text-xl sm:text-4xl font-semibold tracking-tight text-text-primary">
                {formatCurrency(stock.price)}
              </p>
              <p className={`mt-0.5 text-xs sm:text-sm font-medium opacity-70 ${isPositive ? "text-positive" : "text-negative"}`}>
                {stock.change && stock.change >= 0 ? "+" : ""}
                {formatCurrency(stock.change)}
              </p>
            </div>
            <div className={`flex items-center gap-0.5 sm:gap-1 text-lg sm:text-2xl font-semibold ${isPositive ? "text-positive" : "text-negative"}`}>
              <span>{isPositive ? "↑" : "↓"}</span>
              {formatPercent(stock.changePercent)}
            </div>
          </div>
        </div>

        {/* Graph Section */}
        <div className="mt-4 sm:mt-23 mb-2 sm:mb-8 block h-24 sm:h-44 w-full">
          {hasSparkline ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={adjustedSparkline} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor={sparklinePositive ? "#22c55e" : "#ef4444"} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={sparklinePositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                  <Area
                    dataKey="close"
                    stroke={sparklinePositive ? "#22c55e" : "#ef4444"}
                    fill={`url(#${gradientId})`}
                    strokeWidth={1.5}
                    dot={(props) => {
                      const { cx, cy, index } = props;
                      // Use adjustedSparkline here so the endpoint dot renders on the final item
                      if (index !== 0 && index !== adjustedSparkline.length - 1) return <g key={index} />;
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill={sparklinePositive ? "#22c55e" : "#ef4444"}
                          stroke="none"
                        />
                      );
                    }}
                    isAnimationActive={false}
                  />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border-subtle text-xs text-text-muted">
              Sparkline unavailable
            </div>
          )}
        </div>
        
        {/* Ensures the bottom area of the card is also part of the hit-box */}
        <div className="mt-auto" />
      </Link>
    </article>
  );
}