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
  const { searchParams } = new URL(request.url);
  const watchlist = parseWatchlist(searchParams);

  try {
    const movers = await getMarketMovers();
    const topPerformerSymbols = movers.gainers.slice(0, 2).map((stock) => stock.symbol);
    const baseSymbols = watchlist.length >= 10 ? watchlist : MARKET_BAR_SYMBOLS;

    const [baseTickerStocks, topTickerStocks, news] = await Promise.all([
      getStockSummaries(baseSymbols),
      getStockSummaries(topPerformerSymbols),
      getMarketNews().catch(() => [])
    ]);

    return NextResponse.json({
      tickerStocks: [...baseTickerStocks, ...topTickerStocks],
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
