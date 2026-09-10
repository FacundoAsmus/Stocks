import { NextRequest, NextResponse } from "next/server";

import { getCompanyDescription } from "@/lib/secEdgar";
import { getEtfDescription } from "@/lib/etfs";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol || !/^[A-Z.^-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  }

  // These descriptions are curated in lib/etfs.ts. ETFs do not reliably
  // provide the 10-K/20-F business section used by the company fallback.
  const etfDescription = getEtfDescription(symbol);
  if (etfDescription) return NextResponse.json({ description: etfDescription });

  const description = await getCompanyDescription(symbol);
  if (!description) {
    return NextResponse.json(
      { error: "Descriptions are not available right now." },
      { status: 503 },
    );
  }

  return NextResponse.json({ description });
}
