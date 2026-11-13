import { NextRequest, NextResponse } from "next/server";

import { getMarketHeatmapGroup } from "@/lib/marketHeatmap";
import { getCompanyProfile, getQuote } from "@/lib/finnhub";
import type { CompanyProfile } from "@/types/stock";

// The free Profile 2 response includes a market-cap figure, but unlike the
// premium profile it does not include `marketCapCurrency`. These are the
// requested fixed USD conversions for the international listings in the map.
const MARKET_CAP_USD_CONVERSIONS: Record<string, number> = {
  TSM: 1 / 32,
  ASML: 1.15,
  SHEL: 1.30,
  TTE: 1.15,
};

function marketCapInUsd(symbol: string, marketCap: number | undefined) {
  if (!marketCap || marketCap <= 0) return 1;
  return marketCap * (MARKET_CAP_USD_CONVERSIONS[symbol] ?? 1);
}

export async function GET(request: NextRequest) {
  const group = getMarketHeatmapGroup(request.nextUrl.searchParams.get("group"));
  if (!group) return NextResponse.json({ error: "Unknown market group." }, { status: 400 });

  const settled = await Promise.allSettled(
    group.symbols.map(async (symbol) => {
      const [quote, profile] = await Promise.all([
        getQuote(symbol),
        getCompanyProfile(symbol).catch(() => ({} as CompanyProfile)),
      ]);

      return {
        symbol,
        name: profile.name || symbol,
        price: quote.c || null,
        changePercent: quote.dp ?? null,
        // Treasury fund tiles use curated relative AUM. Profile 2 does not
        // provide the market-cap currency, so named overseas listings use the
        // agreed USD fallback conversion above before the treemap is sized.
        weight: group.staticWeights?.[symbol] ?? marketCapInUsd(symbol, profile.marketCapitalization),
      };
    }),
  );

  const stocks = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

  return NextResponse.json({ group: group.id, stocks });
}
