import { NextRequest, NextResponse } from "next/server";

import { getMarketHeatmapGroup } from "@/lib/marketHeatmap";
import { getCompanyProfile, getQuote } from "@/lib/finnhub";
import type { CompanyProfile } from "@/types/stock";

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
        // Finnhub reports company market cap in millions. Treasury fund tiles
        // use their curated relative AUM weight instead.
        weight: group.staticWeights?.[symbol] ?? profile.marketCapitalization ?? 1,
      };
    }),
  );

  const stocks = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

  return NextResponse.json({ group: group.id, stocks });
}
