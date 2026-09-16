import { NextResponse } from "next/server";

import { getFilingIndicators } from "@/lib/secEdgar";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol || !/^[A-Z.-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "A valid stock symbol is required." }, { status: 400 });
  }

  return NextResponse.json({ indicators: await getFilingIndicators(symbol) });
}
