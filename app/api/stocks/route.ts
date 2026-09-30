import { NextResponse } from "next/server";

import { getStockSummaries } from "@/lib/finnhub";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams
    .get("symbols")
    ?.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!symbols?.length) {
    return NextResponse.json({ stocks: [] });
  }

  try {
    const stocks = await getStockSummaries(symbols, forceRefresh);
    return NextResponse.json({ stocks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load watchlist."
      },
      { status: 500 }
    );
  }
}
