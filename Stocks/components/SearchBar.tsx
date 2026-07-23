"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock } from "lucide-react";

const RECENT_KEY = "market-lens-recent-searches";
const MAX_RECENT = 6;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(symbol: string) {
  const current = getRecentSearches();
  const next = [symbol, ...current.filter((s) => s !== symbol)].slice(0, MAX_RECENT);
  sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

type SearchResult = {
  description: string;
  displaySymbol?: string;
  symbol: string;
  type?: string;
};

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setIsOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigateToSymbol(symbol: string) {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;
    addRecentSearch(cleanSymbol);
    setQuery("");
    setIsOpen(false);
    router.push(`/stock/${encodeURIComponent(cleanSymbol)}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const cleanQuery = query.trim().toUpperCase();
  if (!cleanQuery) return;
  if (!results.length) return; // ← add this
  const looksLikeTicker = /^[A-Z.^-]{1,12}$/.test(cleanQuery);
  navigateToSymbol(looksLikeTicker ? cleanQuery : results[0]?.symbol ?? cleanQuery);
  }

  function handleFocus() {
    setRecentSearches(getRecentSearches());
    setIsOpen(true);
  }

  const showRecent = isOpen && !query.trim() && recentSearches.length > 0;
  const showResults = isOpen && query.trim() && results.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full lg:max-w-xl">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          aria-label="Search stocks"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={handleFocus}
          placeholder="Search stocks"
          className="h-11 w-full rounded-md border border-border-subtle bg-panel px-10 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-positive focus:ring-2 focus:ring-positive/20"
        />
        {isLoading ? (
          <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
        ) : null}
      </form>

      {showRecent ? (
        <div className="absolute mt-2 w-full overflow-hidden rounded-md border border-border-subtle bg-panel shadow-2xl shadow-black/30">
          <p className="px-4 py-2 text-xs uppercase tracking-widest text-text-muted">Recent</p>
          {recentSearches.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => navigateToSymbol(symbol)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-panel-muted"
            >
              <Clock className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="font-semibold text-text-primary">{symbol}</span>
            </button>
          ))}
        </div>
      ) : showResults ? (
        <div className="absolute mt-2 w-full overflow-hidden rounded-md border border-border-subtle bg-panel shadow-2xl shadow-black/30">
          {results.map((result) => (
            <button
              key={`${result.symbol}-${result.description}`}
              type="button"
              onClick={() => navigateToSymbol(result.symbol)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-panel-muted"
            >
              <span>
                <span className="block font-semibold text-text-primary">
                  {result.displaySymbol ?? result.symbol}
                </span>
                <span className="block truncate text-text-muted">{result.description}</span>
              </span>
              <span className="text-xs uppercase text-text-muted">Open</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}