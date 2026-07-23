import { JSDOM } from "jsdom";
import { NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";

export const runtime = "nodejs";

// Cap how much extracted text we'll ever hand back — keeps prompt/token
// cost bounded even for very long articles.
const MAX_CHARS = 2200;
// Below this we treat extraction as having failed (paywall teaser, cookie
// wall, "please enable JavaScript" stub, etc.) rather than a real article.
const MIN_USABLE_CHARS = 200;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 5_000_000; // 5MB — refuse to buffer huge pages

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local")) return true;
  // Basic private-network guards (best-effort — this app only ever calls
  // this route with URLs sourced from our own news feed, but it's a public
  // route, so refuse obvious SSRF targets).
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "A url is required." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are supported." }, { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "This host is not allowed." }, { status: 400 });
  }

  try {
    const res = await fetch(target.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Plenty of news sites 403 requests with no/default UA.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Article fetch failed (${res.status}).` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      return NextResponse.json({ error: "URL did not return an HTML page." }, { status: 415 });
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "Page too large." }, { status: 413 });
    }

    const html = await res.text();
    if (html.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: "Page too large." }, { status: 413 });
    }

    const dom = new JSDOM(html, { url: target.toString() });
    const article = new Readability(dom.window.document).parse();

    const text = article?.textContent ? collapseWhitespace(article.textContent) : "";

    if (!text || text.length < MIN_USABLE_CHARS) {
      return NextResponse.json({ error: "Could not extract readable article text (likely paywalled or JS-rendered)." }, { status: 422 });
    }

    return NextResponse.json({
      title: article?.title ?? null,
      byline: article?.byline ?? null,
      text: text.slice(0, MAX_CHARS),
      truncated: text.length > MAX_CHARS,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Article fetch timed out."
      : "Unable to fetch or parse this article.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
