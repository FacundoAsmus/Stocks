import { NextResponse } from "next/server";

import { getStockDetail } from "@/lib/finnhub";
import { getSentimentScore, metricValue } from "@/lib/sentiment";

// Powers the desktop watchlist split view: given ?symbol=XXX, returns the
// same { stock, currentPrice, sentiment, metrics } shape that
// app/stock/[symbol]/page.tsx renders server-side, so the right-hand panel
// can swap stocks client-side without a full page navigation/reload.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol");

  if (!rawSymbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  const normalizedSymbol = decodeURIComponent(rawSymbol).toUpperCase();
  if (!/^[A-Z.^-]{1,12}$/.test(normalizedSymbol)) {
    return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  }

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

    return NextResponse.json({ stock, currentPrice, sentiment, metrics });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : `Unable to load ${normalizedSymbol}.`
      },
      { status: 500 }
    );
  }
}
