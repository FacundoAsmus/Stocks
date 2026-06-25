import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { AnalystSection } from "@/components/AnalystSection";
import { FundamentalsGrid } from "@/components/FundamentalsGrid";
import { MarketSentiment } from "@/components/MarketSentiment";
import { PriceChart } from "@/components/PriceChart";
import { formatCurrency } from "@/lib/format";
import type { StockDetail } from "@/types/stock";

interface MobileStockPageProps {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

export function MobileStockPage({ stock, currentPrice, sentiment, metrics }: MobileStockPageProps) {
  const isPositive = (stock.quote.dp ?? 0) >= 0;

  return (
    <div className="pb-24">
      {/* Back bar */}
      <div className="sticky top-0 z-30 flex items-center gap-2 bg-black/90 backdrop-blur-xl px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Header: logo + name + watchlist */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        {stock.profile.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stock.profile.logo} alt=""
            className="h-12 w-12 rounded-md border border-white/10 bg-white/5 object-contain shrink-0" />
        ) : (
          <span className="h-12 w-12 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-sm font-bold text-text-primary shrink-0">
            {stock.symbol.replace("^", "").slice(0, 2)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-primary leading-tight truncate">{stock.profile.name ?? stock.symbol}</h1>
          <p className="text-xs text-text-muted">{stock.symbol}</p>
        </div>
        <AddToWatchlistButton symbol={stock.symbol} name={stock.profile.name ?? stock.symbol} compact />
      </div>

      {/* Chart — full bleed */}
      <div className="px-2">
        <PriceChart
          symbol={stock.symbol}
          currentPrice={currentPrice}
          currentChangePercent={stock.quote.dp ?? 0}
          previousClose={stock.quote.pc ?? undefined}
          heightClassName="h-[260px]"
        />
      </div>

      {/* Sections stacked */}
      <div className="flex flex-col gap-4 px-4 mt-4">
        <MarketSentiment score={sentiment.score} drivers={sentiment.drivers} />

        <AnalystSection
          recommendations={stock.recommendations}
          priceTarget={stock.priceTarget}
          currentPrice={currentPrice}
        />

        <FundamentalsGrid
          metrics={metrics}
          marketCap={stock.profile.marketCapitalization}
          currentPrice={currentPrice}
        />

        {/* News */}
        {stock.news.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-3">News</p>
            <div className="rounded-xl border border-border-subtle bg-panel overflow-hidden">
              {stock.news.slice(0, 8).map(article => (
                <a key={article.id} href={article.url} target="_blank" rel="noreferrer"
                  className="flex gap-3 px-4 py-3 border-b border-border-subtle/40 last:border-0 active:bg-panel-muted">
                  {article.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={article.image} alt="" className="h-12 w-16 rounded-md object-cover shrink-0 self-start" />
                    : <span className="h-12 w-16 rounded-md bg-panel-muted shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-text-primary leading-snug line-clamp-2">{article.headline}</span>
                    <span className="block mt-1 text-[10px] text-text-muted">{article.source}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
