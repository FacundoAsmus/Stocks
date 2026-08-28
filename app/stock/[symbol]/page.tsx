import { notFound } from "next/navigation";

import { ErrorState } from "@/components/ErrorState";
import { DesktopStockDetail } from "@/components/DesktopStockDetail";
import { getStockDetail } from "@/lib/finnhub";
import { getSentimentScore, metricValue } from "@/lib/sentiment";
import { MobileStockPage } from "@/components/mobile/MobileStockPage";

interface StockPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function StockPage({ params }: StockPageProps) {
  const { symbol } = await params;
  const normalizedSymbol = decodeURIComponent(symbol).toUpperCase();

  if (!/^[A-Z.^-]{1,12}$/.test(normalizedSymbol)) notFound();

  try {
    const stock = await getStockDetail(normalizedSymbol);
    const metrics = stock.financials.metric;
    const currentPrice = stock.quote.c || 0;
    const sentiment = getSentimentScore({
      changePercent: stock.quote.dp,
      beta: metricValue(metrics, "beta"),
      pe: metricValue(metrics, "peTTM") ?? metricValue(metrics, "peNormalizedAnnual"),
      high52: metricValue(metrics, "52WeekHigh"),
      low52: metricValue(metrics, "52WeekLow"),
      currentPrice
    });

    return (
      <>
      {/* Mobile stock page */}
      <div className="lg:hidden page-enter-rise">
        <MobileStockPage
          stock={stock}
          currentPrice={currentPrice}
          sentiment={sentiment}
          metrics={metrics}
        />
      </div>

      {/* Desktop stock page (direct navigation — e.g. from search, market, or portfolio.
          The watchlist page itself no longer routes here on desktop; see
          components/desktop/WatchlistSplitView.tsx for that merged view.) */}
      <div className="hidden lg:block">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <DesktopStockDetail
            stock={stock}
            currentPrice={currentPrice}
            sentiment={sentiment}
            metrics={metrics}
          />
        </div>
      </div>
      </>
    );
  } catch (error) {
    return (
      <ErrorState
        title={`Unable to load ${normalizedSymbol}`}
        message={error instanceof Error ? error.message : "Something went wrong while loading this stock."}
      />
    );
  }
}
