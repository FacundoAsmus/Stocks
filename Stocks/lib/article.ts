import "server-only";

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export type ArticleInput = {
  headline?: string;
  source?: string;
  summary?: string;
  url?: string;
};

export type ExtractedArticle = {
  byline: string | null;
  excerpt: string | null;
  length: number;
  siteName: string | null;
  text: string;
  title: string;
  url: string;
};

type CacheEntry = {
  expiresAt: number;
  value: ExtractedArticle;
};

const ARTICLE_CACHE_TTL_MS = 1000 * 60 * 30;
const ARTICLE_FETCH_TIMEOUT_MS = 10_000;
const MAX_ARTICLE_CHARS = 6_000;
const MAX_ARTICLES_FOR_CONTEXT = 3;
const articleCache = new Map<string, CacheEntry>();

const FINANCE_QUERY_TERMS = [
  "article",
  "news",
  "headline",
  "story",
  "report",
  "source",
  "ceo",
  "said",
  "earnings",
  "revenue",
  "profit",
  "guidance",
  "forecast",
  "downgrade",
  "upgrade",
  "analyst",
  "lawsuit",
  "regulation",
  "china",
  "tariff",
  "why",
  "today",
  "down",
  "up",
  "fall",
  "fell",
  "rise",
  "rose"
];

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function truncateArticle(text: string, maxChars = MAX_ARTICLE_CHARS) {
  const clean = normalizeWhitespace(text);
  if (clean.length <= maxChars) return clean;

  const slice = clean.slice(0, maxChars);
  const lastSentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  if (lastSentence > maxChars * 0.65) return `${slice.slice(0, lastSentence + 1).trim()}...`;

  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxChars).trim()}...`;
}

function assertSafeArticleUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid article URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Article URL must use HTTP or HTTPS.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new Error("Local article URLs are not allowed.");
  }

  if (/^(10|127|169\.254|192\.168)\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    throw new Error("Private network article URLs are not allowed.");
  }

  return url;
}

export async function extractArticle(rawUrl: string): Promise<ExtractedArticle> {
  const url = assertSafeArticleUrl(rawUrl);
  const cacheKey = url.toString();
  const cached = articleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "MarketLensArticleReader/1.0 (+https://github.com/FacundoAsmus/Stocks)"
    },
    signal: AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Article request failed with status ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("Article URL did not return HTML.");
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url: cacheKey });
  const parsed = new Readability(dom.window.document).parse();
  const title = normalizeWhitespace(parsed?.title || dom.window.document.title || url.hostname);
  const text = truncateArticle(parsed?.textContent || dom.window.document.body?.textContent || "");

  if (text.length < 200) {
    throw new Error("Article text was too short to use.");
  }

  const value: ExtractedArticle = {
    byline: parsed?.byline ?? null,
    excerpt: parsed?.excerpt ? truncateArticle(parsed.excerpt, 500) : null,
    length: text.length,
    siteName: parsed?.siteName ?? null,
    text,
    title,
    url: cacheKey
  };

  articleCache.set(cacheKey, { value, expiresAt: Date.now() + ARTICLE_CACHE_TTL_MS });
  return value;
}

function tokenize(text: string) {
  const stop = new Set(["about", "after", "also", "because", "between", "from", "have", "into", "that", "their", "there", "this", "what", "when", "where", "which", "with", "would"]);
  return normalizeWhitespace(text.toLowerCase())
    .replace(/[^a-z0-9.%$ -]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stop.has(word));
}

function scoreArticle(question: string, article: ArticleInput, index: number) {
  const questionTokens = new Set(tokenize(question));
  const haystack = tokenize(`${article.headline ?? ""} ${article.source ?? ""} ${article.summary ?? ""}`);
  let score = 0;

  for (const token of haystack) {
    if (questionTokens.has(token)) score += 3;
  }

  if (/today|latest|recent|now|why|news|article|headline/i.test(question)) score += Math.max(0, 8 - index);
  if (/\bearnings?\b/i.test(`${question} ${article.headline ?? ""} ${article.summary ?? ""}`)) score += 4;
  if (/\b(analyst|upgrade|downgrade|target)\b/i.test(`${question} ${article.headline ?? ""} ${article.summary ?? ""}`)) score += 3;

  return score;
}

export function shouldUseArticleContext(question: string) {
  const normalized = question.toLowerCase();
  const terms = new Set(FINANCE_QUERY_TERMS);
  return tokenize(normalized).some((token) => terms.has(token));
}

export function selectRelevantArticles(question: string, articles: ArticleInput[]) {
  const explicitIndexes = [...question.matchAll(/\b(?:article|news|headline)\s*#?\s*(\d+)\b/gi)]
    .map((match) => Number(match[1]))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < articles.length);

  const selected = new Set<number>(explicitIndexes);
  const scored = articles
    .map((article, index) => ({ article, index, score: scoreArticle(question, article, index) }))
    .filter(({ article }) => article.url)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const item of scored) {
    if (selected.size >= MAX_ARTICLES_FOR_CONTEXT) break;
    if (item.score > 0 || selected.size === 0) selected.add(item.index);
  }

  return [...selected]
    .slice(0, MAX_ARTICLES_FOR_CONTEXT)
    .map((index) => ({ index, article: articles[index] }))
    .filter(({ article }) => article?.url);
}
