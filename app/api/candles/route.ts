import { NextResponse } from "next/server";

import { getStockCandleHistory, getStockCandles } from "@/lib/finnhub";
import type { ChartPeriod } from "@/types/stock";

const PERIODS: ChartPeriod[] = ["1D", "1W", "1M", "2M", "3M", "5M", "6M", "1Y", "2Y", "5Y", "ALL"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const period = searchParams.get("period")?.toUpperCase() as ChartPeriod | null;
  const beforeParam = searchParams.get("before");
  const historyDaysParam = searchParams.get("historyDays");
  const before = beforeParam === null ? null : Number(beforeParam);
  const historyDays = historyDaysParam === null ? null : Number(historyDaysParam);

  if (!symbol) {
    return NextResponse.json({ error: "A stock symbol is required." }, { status: 400 });
  }

  if (!period || !PERIODS.includes(period)) {
    return NextResponse.json({ error: "Use one of these periods: 1D, 1W, 1M, 2M, 3M, 5M, 6M, 1Y, 2Y, 5Y, ALL." }, { status: 400 });
  }

  try {
    if (beforeParam !== null || historyDaysParam !== null) {
      if (before === null || !Number.isFinite(before) || before <= 0 || historyDays === null || !Number.isInteger(historyDays) || historyDays < 1 || historyDays > 99) {
        return NextResponse.json({ error: "A valid history window is required." }, { status: 400 });
      }

      const candles = await getStockCandleHistory(symbol, period, before, historyDays);
      return NextResponse.json({ candles });
    }

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
