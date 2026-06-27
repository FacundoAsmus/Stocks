import { notFound } from "next/navigation";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { AnalystSection } from "@/components/AnalystSection";
import { ErrorState } from "@/components/ErrorState";
import { FundamentalsGrid } from "@/components/FundamentalsGrid";
import { MarketSentiment } from "@/components/MarketSentiment";
import { NewsCard } from "@/components/NewsCard";
import { PriceChart } from "@/components/PriceChart";
import { getStockDetail } from "@/lib/finnhub";
import { MobileStockPage } from "@/components/mobile/MobileStockPage";

interface StockPageProps {
  params: Promise<{ symbol: string }>;
}

function metricValue(metrics: Record<string, number | string | null> | undefined, key: string) {
  const value = metrics?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getSentimentScore({
  changePercent,
  beta,
  pe,
  high52,
  low52,
  currentPrice
}: {
  changePercent: number | null;
  beta: number | null;
  pe: number | null;
  high52: number | null;
  low52: number | null;
  currentPrice: number;
}) {
  let score = 50;
  const drivers: string[] = [];

  // Daily momentum — primary signal (60% of the score movement)
  if (changePercent !== null) {
    score += clamp(changePercent * 3, -15, 15);
    drivers.push(changePercent >= 1 ? "Strong positive momentum"
      : changePercent >= 0 ? "Positive daily momentum"
      : changePercent > -1 ? "Slight negative momentum"
      : "Negative daily momentum");
  }

  // 52W range position — strong sentiment signal
  if (high52 && low52 && currentPrice) {
    const rangePosition = ((currentPrice - low52) / (high52 - low52)) * 100;
    if (rangePosition > 85) {
      score += 12;
      drivers.push("Near 52-week high");
    } else if (rangePosition > 60) {
      score += 5;
      drivers.push("Upper 52-week range");
    } else if (rangePosition < 20) {
      score -= 12;
      drivers.push("Near 52-week low");
    } else if (rangePosition < 40) {
      score -= 5;
      drivers.push("Lower 52-week range");
    } else {
      drivers.push("Mid 52-week range");
    }
  }

  // P/E — only flag extremes, don't penalize normal growth premiums
  if (pe !== null && pe > 0) {
    if (pe < 12) {
      score += 5;
      drivers.push("Deep value P/E");
    } else if (pe > 80) {
      score -= 8;
      drivers.push("Extreme valuation (P/E > 80)");
    } else if (pe > 60) {
      score -= 4;
      drivers.push("High valuation (P/E > 60)");
    }
    // 12–60 P/E: no penalty — covers most legitimate growth stocks
  }

  // Beta — informational only, very small weight
  if (beta !== null) {
    if (beta < 0.6) {
      score += 3;
      drivers.push("Low volatility stock");
    } else if (beta > 2) {
      score -= 3;
      drivers.push("High volatility stock");
    }
  }

  return {
    score: Math.round(clamp(score)),
    drivers: drivers.length ? drivers : ["Limited sentiment inputs available"]
  };
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
      <div className="lg:hidden page-enter-grow">
        <MobileStockPage
          stock={stock}
          currentPrice={currentPrice}
          sentiment={sentiment}
          metrics={metrics}
        />
      </div>

      {/* Desktop stock page */}
      <div className="hidden lg:block">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md -muted text-lg font-semibold">
                  {stock.symbol.replace("^", "").slice(0, 2)}
                </div>
              )}
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
        />

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">News</p>
              <h2 className="mt-2 text-2xl font-semibold text-text-primary">Latest headlines</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
