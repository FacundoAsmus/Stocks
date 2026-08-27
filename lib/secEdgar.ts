import "server-only";

// SEC EDGAR is free and requires no API key, but every request MUST send a
// descriptive User-Agent identifying who's making the request — the SEC
// blocks requests with a missing/generic one. Replace the contact info
// below with your own before deploying (SEC's own guidance: "company name
// admin contact@domain.com").
const SEC_USER_AGENT = "redx2002x2@gmail.com";

const TICKER_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // company_tickers.json rarely changes
const DESCRIPTION_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // filings/descriptions rarely change

type CacheEntry<T> = { value: T; expiresAt: number };
const tickerMapCache: { entry: CacheEntry<Map<string, string>> | null } = { entry: null };
const descriptionCache = new Map<string, CacheEntry<string | null>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
  return !!entry && entry.expiresAt > Date.now();
}

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      "Accept-Encoding": "gzip, deflate",
    },
    // These endpoints change rarely; let Next.js cache at the fetch layer too.
    next: { revalidate: 60 * 60 * 24 },
  });
}

// SEC publishes a single JSON file mapping every ticker to its CIK. It's a
// few hundred KB — fine to fetch once and cache in memory for a day.
async function getTickerMap(): Promise<Map<string, string>> {
  if (isFresh(tickerMapCache.entry)) return tickerMapCache.entry.value;

  const res = await secFetch("https://www.sec.gov/files/company_tickers.json");
  if (!res.ok) throw new Error(`SEC ticker map fetch failed: ${res.status}`);
  const data = await res.json() as Record<string, { cik_str: number; ticker: string; title: string }>;

  const map = new Map<string, string>();
  for (const entry of Object.values(data)) {
    map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
  }
  tickerMapCache.entry = { value: map, expiresAt: Date.now() + TICKER_CACHE_TTL_MS };
  return map;
}

async function getCik(symbol: string): Promise<string | null> {
  const map = await getTickerMap();
  return map.get(symbol.toUpperCase().replace(/^\^/, "")) ?? null;
}

type SubmissionsResponse = {
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      primaryDocument?: string[];
    };
  };
};

// Finds the most recent annual-report-style filing (10-K for US domestic
// filers, 20-F for foreign private issuers) and returns enough info to
// build a direct URL to the actual filing document.
async function findLatestAnnualReport(cik: string): Promise<{ accessionNumber: string; primaryDocument: string } | null> {
  const res = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
  if (!res.ok) return null;
  const data = await res.json() as SubmissionsResponse;

  const forms = data.filings?.recent?.form ?? [];
  const accns = data.filings?.recent?.accessionNumber ?? [];
  const docs  = data.filings?.recent?.primaryDocument ?? [];

  const annualFormTypes = new Set(["10-K", "10-K405", "20-F"]);
  for (let i = 0; i < forms.length; i++) {
    if (annualFormTypes.has(forms[i])) {
      return { accessionNumber: accns[i], primaryDocument: docs[i] };
    }
  }
  return null;
}

// Extracts a readable paragraph or two from the filing's "Item 1. Business"
// section. Filing HTML structure varies a lot between companies, so this is
// necessarily a best-effort heuristic rather than a guaranteed parse.
function extractBusinessDescription(html: string): string | null {
  // Strip script/style blocks, then all remaining tags, collapsing entities
  // and whitespace so we're working with plain, readable text.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

  // Find the START of the actual narrative "Item 1. Business" section, not
  // its appearance in a table of contents (ToC mentions are usually
  // immediately followed by a page number and very little other text
  // before the next "Item" — real section starts have substantial prose
  // after them, so we look for a match that's followed by a long run of
  // text before the next "Item").
  const itemStartPattern = /item\s*1\.{0,1}\s*business/gi;
  let bodyStart = -1;
  let match: RegExpExecArray | null;
  while ((match = itemStartPattern.exec(text))) {
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 400);
    // Real section bodies have real sentences shortly after the heading;
    // ToC entries are typically just whitespace/digits/dots before the next heading.
    if (/[a-z]{20,}/i.test(after)) {
      bodyStart = match.index + match[0].length;
      break;
    }
  }
  if (bodyStart === -1) return null;

  const rest = text.slice(bodyStart);
  const endMatch = /item\s*1a\.{0,1}\s*risk\s*factors/i.exec(rest);
  let body = endMatch ? rest.slice(0, endMatch.index) : rest.slice(0, 4000);

  body = body.trim();
  if (body.length < 100) return null; // too short to be a real description

  // Trim to a reasonable paragraph length, ending on a sentence boundary.
  const MAX_LEN = 1600;
  if (body.length > MAX_LEN) {
    const cut = body.slice(0, MAX_LEN);
    const lastPeriod = cut.lastIndexOf(". ");
    body = lastPeriod > MAX_LEN * 0.5 ? cut.slice(0, lastPeriod + 1) : cut + "…";
  }
  return body;
}

// Best-effort — returns null (never throws) for anything that isn't a
// straightforward US/foreign-filer 10-K/20-F situation: ETFs, very recent
// IPOs without a filed annual report yet, ADRs without a US filing, or any
// step along the way failing. A missing description just means the UI
// shows nothing, per how this is meant to be used.
export async function getCompanyDescription(symbol: string): Promise<string | null> {
  const cacheKey = symbol.toUpperCase();
  const cached = descriptionCache.get(cacheKey);
  if (isFresh(cached)) return cached.value;

  try {
    const cik = await getCik(symbol);
    if (!cik) throw new Error("no CIK");

    const filing = await findLatestAnnualReport(cik);
    if (!filing) throw new Error("no annual report on file");

    const accessionNoDashes = filing.accessionNumber.replace(/-/g, "");
    const cikNoLeadingZeros = String(Number(cik));
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${filing.primaryDocument}`;

    const docRes = await secFetch(docUrl);
    if (!docRes.ok) throw new Error(`filing fetch failed: ${docRes.status}`);
    const html = await docRes.text();

    const description = extractBusinessDescription(html);
    descriptionCache.set(cacheKey, { value: description, expiresAt: Date.now() + DESCRIPTION_CACHE_TTL_MS });
    return description;
  } catch {
    // Cache the miss too (shorter-lived) so a bad symbol doesn't retry on
    // every page load, but doesn't get stuck forever if it's transient.
    descriptionCache.set(cacheKey, { value: null, expiresAt: Date.now() + 1000 * 60 * 30 });
    return null;
  }
}
