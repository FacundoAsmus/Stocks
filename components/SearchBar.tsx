"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { Search, Clock } from "lucide-react";

import { SECTOR_ETFS } from "@/lib/etfs";

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

// Same glass treatment as the mobile search sheet's results bubble
// (components/MobileNav.tsx) — translucent gradient + heavy blur, not a
// solid panel.
// Icon for one result/recent row: real logo when available, with the same
// graceful fallback mobile uses (ETF label for ETFs, else first two letters
// of the symbol) if there's no logo or the image fails to load.
function ResultIcon({ symbol, logo }: { symbol: string; logo?: string }) {
  const isEtf = SECTOR_ETFS.some((e) => e.symbol === symbol);
  return (
    <>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md border border-border-subtle bg-panel-muted object-contain"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary ${logo ? "hidden" : ""}`}
      >
        {isEtf ? "ETF" : symbol.replace("^", "").slice(0, 2)}
      </span>
    </>
  );
}

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Logos are a nice-to-have enrichment fetched separately from the search
  // results themselves (/api/search doesn't return them) — same two-step
  // approach as the mobile search sheet. A failure here never clears the
  // real results that already loaded.
  async function fetchLogosFor(symbols: string[], signal?: AbortSignal) {
    if (!symbols.length) return;
    try {
      const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbols.join(","))}`, { signal });
      const data = (await response.json()) as { stocks?: Array<{ symbol: string; logo?: string }> };
      if (signal?.aborted) return;
      setLogos((prev) => {
        const next = { ...prev };
        for (const s of data.stocks ?? []) if (s.logo) next[s.symbol] = s.logo;
        return next;
      });
    } catch {
      /* logos are optional — results stay intact either way */
    }
  }

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
        const newResults = data.results ?? [];
        setResults(newResults);
        setIsOpen(true);
        fetchLogosFor(newResults.map((r) => r.symbol), controller.signal);
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
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const updateDropdownPosition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 24);
      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      });
    };
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen]);

  function navigateToSymbol(symbol: string) {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;
    addRecentSearch(cleanSymbol);
    setQuery("");
    setIsOpen(false);

    // On the watchlist page, opening a search result should preview it in
    // the right-hand 3/4 panel of the split view in place — not navigate
    // away from the page, and not add it to the watchlist itself (that
    // still only happens via the star button on the detail panel).
    if (pathname === "/watchlist") {
      window.dispatchEvent(new CustomEvent("watchlist-preview-symbol", { detail: cleanSymbol }));
      return;
    }

    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent("market-preview-symbol", { detail: cleanSymbol }));
      return;
    }

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
    const recent = getRecentSearches();
    setRecentSearches(recent);
    setIsOpen(true);
    fetchLogosFor(recent);
  }

  const showRecent = isOpen && !query.trim() && recentSearches.length > 0;
  const showResults = isOpen && query.trim() && results.length > 0;
  const dropdownStyle = dropdownPosition ? {
    position: "fixed" as const,
    top: dropdownPosition.top,
    left: dropdownPosition.left,
    width: dropdownPosition.width,
    maxHeight: `calc(100vh - ${dropdownPosition.top + 16}px)`,
    zIndex: 1201,
  } : undefined;

  return (
    <>
    <div ref={wrapperRef} className="relative w-full lg:max-w-xl">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
        <input
          aria-label="Search stocks"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={handleFocus}
          placeholder="Search stocks"
          className="h-11 w-full rounded-full border border-border-subtle bg-panel px-10 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {isLoading ? (
          <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />
        ) : null}
      </form>

    </div>
    {(showRecent || showResults) && dropdownPosition && typeof document !== "undefined" && createPortal(
      showRecent ? (
        <div ref={dropdownRef} className="search-results-glass desktop-alert-glass smoked-glass-surface fixed w-full overflow-auto rounded-2xl border border-white/15" style={{ ...dropdownStyle, background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)" }}>
          <p className="px-4 py-2 text-xs uppercase tracking-widest text-text-muted">Recent</p>
          {recentSearches.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => navigateToSymbol(symbol)}
              className="flex w-full items-center gap-3 border-t border-border-subtle/40 px-4 py-3 text-left text-sm transition hover:bg-white/5"
            >
              <ResultIcon symbol={symbol} logo={logos[symbol]} />
              <span className="font-semibold text-text-primary">{symbol}</span>
              <Clock className="ml-auto h-4 w-4 shrink-0 text-text-muted" />
            </button>
          ))}
        </div>
      ) : (
        <div ref={dropdownRef} className="search-results-glass desktop-alert-glass smoked-glass-surface fixed w-full overflow-auto rounded-2xl border border-white/15" style={{ ...dropdownStyle, background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)" }}>
          {results.map((result) => (
            <button
              key={`${result.symbol}-${result.description}`}
              type="button"
              onClick={() => navigateToSymbol(result.symbol)}
              className="flex w-full items-center gap-3 border-t border-border-subtle/40 px-4 py-3 text-left text-sm transition first:border-t-0 hover:bg-white/5"
            >
              <ResultIcon symbol={result.symbol} logo={logos[result.symbol]} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text-primary">
                  {result.displaySymbol ?? result.symbol}
                </span>
                <span className="block truncate text-text-muted">{result.description}</span>
              </span>
              <span className="shrink-0 text-xs uppercase text-text-muted">Open</span>
            </button>
          ))}
        </div>
      ), document.body
    )}
    </>
  );
}
