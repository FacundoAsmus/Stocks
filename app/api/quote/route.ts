import { NextResponse } from "next/server";
import { getQuote } from "@/lib/finnhub";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z.^-]{1,12}$/.test(symbol)) return NextResponse.json({ error: "Invalid symbol." }, { status: 400 });
  const quote = await getQuote(symbol);
  if (!quote.c || quote.c <= 0) return NextResponse.json({ error: "No current price available." }, { status: 502 });
  return NextResponse.json({ price: quote.c }, { headers: { "Cache-Control": "no-store" } });
}
