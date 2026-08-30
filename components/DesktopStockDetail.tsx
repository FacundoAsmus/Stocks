import type { RefObject } from "react";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { AnalystSection } from "@/components/AnalystSection";
import { FundamentalsGrid } from "@/components/FundamentalsGrid";
import { DesktopEarningsCalendar } from "@/components/desktop/DesktopEarningsCalendar";
import { MarketSentiment } from "@/components/MarketSentiment";
import { NewsCard } from "@/components/NewsCard";
import { PriceChart } from "@/components/PriceChart";
import { SECTOR_ETFS } from "@/lib/etfs";
import { cn } from "@/lib/utils";
import type { getStockDetail } from "@/lib/finnhub";

type StockDetail = Awaited<ReturnType<typeof getStockDetail>>;

interface DesktopStockDetailProps {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
  /** Height passed to the price chart. Defaults to the size used on the standalone stock page. */
  chartHeightClassName?: string;
  /** When provided (e.g. from the watchlist split view), the earnings
   *  calendar sheet is confined to this element's bounds instead of the
   *  full viewport. Left undefined on the standalone stock page, where
   *  full-viewport is correct. */
  earningsCalendarContainerRef?: RefObject<HTMLElement | null>;
}

// This is the exact "Desktop stock page" content that used to live inline in
// app/stock/[symbol]/page.tsx. It's now a standalone component so it can be
// rendered both there (full page, unchanged) and inside the right-hand panel
// of the merged desktop watchlist view.
export function DesktopStockDetail({
  stock,
  currentPrice,
  sentiment,
  metrics,
  chartHeightClassName = "h-[384px]",
  earningsCalendarContainerRef
}: DesktopStockDetailProps) {
  // ETFs don't file earnings reports the way individual companies do — same
  // check the mobile stock page already uses to hide the calendar button and
  // filter irrelevant fundamentals (P/E, EPS, etc.) out of the grid.
  const isEtf = SECTOR_ETFS.some((e) => e.symbol === stock.symbol);
  return (
    <div className="relative space-y-6">
      <div className="relative z-10 space-y-6">
        <section className="relative p-5">
          <div className="absolute right-5 top-5 z-10">
            <AddToWatchlistButton symbol={stock.symbol} name={stock.profile.name ?? stock.symbol} compact />
          </div>
          {/* ── Logo + name row ── */}
          <div className="flex gap-4 items-start">
            <div className="shrink-0">
              {stock.profile.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stock.profile.logo}
                  alt=""
                  className="h-14 w-14 rounded-md border border-white/10 bg-white/5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <span
                className={cn(
                  "h-14 w-14 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-lg font-semibold text-text-primary",
                  stock.profile.logo && "hidden"
                )}
              >
                {isEtf ? "ETF" : stock.symbol.replace("^", "").slice(0, 2)}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-text-primary sm:text-4xl">
                {stock.profile.name ?? stock.symbol}
              </h1>
              <p className="mt-0.5 text-base text-text-muted">{stock.symbol}</p>
            </div>
          </div>
          {/* ── Price + chart — price indented to align with name, chart full width ── */}
          <div className="mt-4">
            <PriceChart
              symbol={stock.symbol}
              currentPrice={currentPrice}
              currentChangePercent={stock.quote.dp ?? 0}
              previousClose={stock.quote.pc ?? undefined}
              heightClassName={chartHeightClassName}
            />
          </div>
        </section>

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
          earnings={stock.earnings}
          isEtf={isEtf}
        />

        {!isEtf && (
          <div className="flex justify-end -mt-2">
            <DesktopEarningsCalendar earnings={stock.earnings} containerRef={earningsCalendarContainerRef} />
          </div>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">News</p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary">Latest headlines</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {stock.news.length ? (
              stock.news.map((article) => <NewsCard key={article.id} article={article} />)
            ) : (
              <div className="rounded-md  p-5 text-sm text-text-muted">
                No recent Finnhub news was available for this symbol.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
