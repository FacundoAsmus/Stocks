import { NextResponse } from "next/server";

import { getStockSummaries } from "@/lib/finnhub";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams
    .get("symbols")
    ?.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols?.length) {
    return NextResponse.json({ stocks: [] });
  }

  try {
    const stocks = await getStockSummaries(symbols);
    return NextResponse.json({ stocks });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load watchlist."
      },
      { status: 500 }
    );
  }
}
