import { NextResponse } from "next/server";

import { MARKET_BAR_SYMBOLS } from "@/lib/constants";
import { getMarketMovers, getMarketNews, getStockSummaries } from "@/lib/finnhub";

function parseWatchlist(searchParams: URLSearchParams) {
  return searchParams
    .get("watchlist")
    ?.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean) ?? [];
}

export async function GET(request: Request) {
  const requestStart = performance.now();
  const { searchParams } = new URL(request.url);
  const watchlist = parseWatchlist(searchParams);

  try {
    // Always include watchlist symbols + ticker bar symbols (deduped)
    const baseSymbols = [...new Set([...watchlist, ...MARKET_BAR_SYMBOLS])];

    // getMarketMovers() already fetches enriched summaries (logo + sparkline) for
    // its top gainers/losers internally, so we run it alongside the ticker-bar
    // fetch instead of awaiting it first and then re-fetching the top performers
    // a second time. This removes one full sequential round-trip wave.
    const [movers, baseTickerStocks, news] = await Promise.all([
      getMarketMovers(),
      getStockSummaries(baseSymbols),
      getMarketNews().catch(() => [])
    ]);

    const topPerformerStocks = movers.gainers.slice(0, 2);

    if (process.env.DEBUG_PERF === "1") {
      console.log(`[perf] TOTAL /api/market: ${(performance.now() - requestStart).toFixed(0)}ms`);
    }

    return NextResponse.json({
      tickerStocks: [...baseTickerStocks, ...topPerformerStocks],
      gainers: movers.gainers,
      losers: movers.losers,
      news: news.slice(0, 12)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load market data."
      },
      { status: 500 }
    );
  }
}
