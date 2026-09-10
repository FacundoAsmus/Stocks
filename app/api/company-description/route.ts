import { NextRequest, NextResponse } from "next/server";

import { getCompanyDescription } from "@/lib/secEdgar";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol || !/^[A-Z.^-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  }

  const description = await getCompanyDescription(symbol);
  if (!description) {
    return NextResponse.json(
      { error: "Descriptions are not available right now." },
      { status: 503 },
    );
  }

  return NextResponse.json({ description });
}
