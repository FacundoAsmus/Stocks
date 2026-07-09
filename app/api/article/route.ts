import { NextRequest, NextResponse } from "next/server";

import { extractArticle } from "@/lib/article";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const article = await extractArticle(url);
    return NextResponse.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Article extraction failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const article = await extractArticle(body.url);
    return NextResponse.json(article);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Article extraction failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

