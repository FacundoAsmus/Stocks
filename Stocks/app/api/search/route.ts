import { NextResponse } from "next/server";

import { POPULAR_STOCKS } from "@/lib/constants";
import { searchSymbols } from "@/lib/finnhub";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  try {
    if (!query) {
      return NextResponse.json({ results: POPULAR_STOCKS });
    }

    const results = await searchSymbols(query);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed."
      },
      { status: 500 }
    );
  }
}
