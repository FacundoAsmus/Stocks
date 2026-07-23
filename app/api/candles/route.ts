import { NextResponse } from "next/server";

import { getStockCandles } from "@/lib/finnhub";
import type { ChartPeriod } from "@/types/stock";

const PERIODS: ChartPeriod[] = ["1D", "1W", "1M", "2M", "3M", "5M", "6M", "1Y", "2Y", "5Y", "ALL"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const period = searchParams.get("period")?.toUpperCase() as ChartPeriod | null;

  if (!symbol) {
    return NextResponse.json({ error: "A stock symbol is required." }, { status: 400 });
  }

  if (!period || !PERIODS.includes(period)) {
    return NextResponse.json({ error: "Use one of these periods: 1D, 1W, 1M, 2M, 3M, 5M, 6M, 1Y, 2Y, 5Y, ALL." }, { status: 400 });
  }

  try {
    const candles = await getStockCandles(symbol, period);

    if (!candles.length) {
      return NextResponse.json(
        { error: "No historical price data was available for this symbol and period." },
        { status: 404 }
      );
    }

    return NextResponse.json({ candles });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load price chart."
      },
      { status: 500 }
    );
  }
}
