"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { AnalystSection } from "@/components/AnalystSection";
import { PriceChart } from "@/components/PriceChart";

import { StockAIChat } from "@/components/mobile/StockAIChat";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { StockDetail } from "@/types/stock";

export function MobileStockPage({ symbol }: { symbol: string }) {
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<StockDetail>)
      .then((d) => setStock(d))
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [symbol]);

  const isPos = ((stock?.summary.changePercent ?? 0) >= 0);

  return (
    <div className="pb-28">
      {/* Translucent top header with safe area padding */}
      <div
        className="sticky top-0 z-30 px-4 pb-3 flex items-center justify-between bg-background/40 backdrop-blur-xl border-b border-border-subtle/30"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-panel-muted text-text-primary active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <AddToWatchlistButton symbol={symbol} />
          <StockAIChat ticker={symbol} />
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Ticker & Price Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{symbol}</h1>
            <p className="text-xs text-text-muted">{stock?.summary.name}</p>
          </div>
          {stock && (
            <div className="text-right">
              <div className="text-xl font-bold text-text-primary">
                {formatCurrency(stock.summary.price)}
              </div>
              <div
                className={`text-xs font-semibold ${
                  isPos ? "text-positive" : "text-negative"
                }`}
              >
                {formatPercent(stock.summary.changePercent)}
              </div>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="mt-4 rounded-xl border border-border-subtle bg-panel-solid p-3">
          <PriceChart symbol={symbol} />
        </div>

        {/* Analysts / Fundamentals */}
        {stock && (
          <div className="mt-4">
            <AnalystSection detail={stock} />
          </div>
        )}
      </div>
    </div>
  );
}