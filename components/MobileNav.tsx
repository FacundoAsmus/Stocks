"use client";

import { List, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M4.5 7.5 Q12 6 19.5 7.5" />
      <path d="M4.5 16.5 Q12 18 19.5 16.5" />
      <path d="M12 3 Q6.5 12 12 21" />
      <path d="M12 3 Q17.5 12 12 21" />
    </svg>
  );
}

// ─── Session flag: did user navigate to stock page from search? ───────────
// Uses sessionStorage so it survives Next.js server/client boundaries.
const SEARCH_NAV_KEY = "ml_from_search";
export function markNavigatedFromSearch() {
  if (typeof window !== "undefined") sessionStorage.setItem(SEARCH_NAV_KEY, "1");
}
export function consumeNavigatedFromSearch(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(SEARCH_NAV_KEY) === "1";
  sessionStorage.removeItem(SEARCH_NAV_KEY);
  return v;
}

// ─── Search Circle Overlay ────────────────────────────────────────────────
// Exported so MobileStockPage can render it for the reverse-collapse on back.
interface SearchOverlayProps {
  onClose: () => void;
  onNavigate: (symbol: string) => void;
  /** Start already-expanded and immediately begin collapsing */
  reverseOnly?: boolean;
}

export function MobileSearchOverlay({ onClose, onNavigate, reverseOnly = false }: SearchOverlayProps) {
  const [expanded, setExpanded] = useState(reverseOnly); // if reversing, start expanded
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (reverseOnly) {
      // Immediately collapse
      const t = setTimeout(() => {
        setExpanded(false);
        setTimeout(onClose, 720);
      }, 30); // tiny delay so the expanded state paints first
      return () => clearTimeout(t);
    } else {
      // Normal open: expand from circle
      requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus keyboard after expand animation finishes (normal open only)
  useEffect(() => {
    if (!reverseOnly && expanded) {
      const t = setTimeout(() => inputRef.current?.focus(), 700);
      return () => clearTimeout(t);
    }
  }, [expanded, reverseOnly]);

  function collapse() {
    setExpanded(false);
    setTimeout(onClose, 720);
  }

  async function doSearch(q: string) {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { results?: Array<{ symbol: string; description: string }> };
      setResults((data.results ?? []).slice(0, 8).map(r => ({ symbol: r.symbol, name: r.description })));
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  return (
    <div
      className="fixed z-50 overflow-hidden bg-black/96 backdrop-blur-xl"
      style={{
        bottom: expanded ? 0 : "calc(1.25rem + env(safe-area-inset-bottom))",
        right:  expanded ? 0 : "1rem",
        width:  expanded ? "100vw"  : "2.75rem",
        height: expanded ? "100dvh" : "2.75rem",
        borderRadius: expanded ? "0px" : "50%",
        transition: [
          "width 700ms cubic-bezier(0.4,0,0.2,1)",
          "height 700ms cubic-bezier(0.4,0,0.2,1)",
          "border-radius 700ms cubic-bezier(0.4,0,0.2,1)",
          "bottom 700ms cubic-bezier(0.4,0,0.2,1)",
          "right 700ms cubic-bezier(0.4,0,0.2,1)",
        ].join(", "),
      }}
    >
      <div
        className="flex flex-col h-full"
        style={{
          opacity: expanded ? 1 : 0,
          transition: "opacity 250ms ease",
          transitionDelay: expanded ? "400ms" : "0ms",
          pointerEvents: expanded ? "auto" : "none",
        }}
      >
        {/* Only show search UI when not in reverse-only mode */}
        {!reverseOnly && (
          <>
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 pt-14 pb-4">
              <Search className="h-5 w-5 text-text-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => doSearch(e.target.value)}
                placeholder="Search stocks…"
                className="flex-1 bg-transparent text-lg text-text-primary placeholder:text-text-muted outline-none"
              />
              <button onClick={collapse} className="text-text-muted active:text-text-primary p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {searching && <p className="px-4 py-6 text-sm text-text-muted">Searching…</p>}
              {results.map(r => (
                <button
                  key={r.symbol}
                  className="w-full flex items-center gap-3 px-4 py-4 border-b border-border-subtle/40 text-left active:bg-panel-muted"
                  onClick={() => onNavigate(r.symbol)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary shrink-0">
                    {r.symbol.slice(0, 2)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">{r.symbol}</span>
                    <span className="block text-xs text-text-muted truncate">{r.name}</span>
                  </span>
                </button>
              ))}
              {!searching && query && !results.length && (
                <p className="px-4 py-6 text-sm text-text-muted">No results for &ldquo;{query}&rdquo;</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Slide helpers ────────────────────────────────────────────────────────
const SLIDE_MS = 480;

function slideAndNavigate(
  router: ReturnType<typeof useRouter>,
  href: "/" | "/watchlist",
  exitClass: "page-slide-left" | "page-slide-right",
) {
  const main = document.querySelector("main");
  if (!main) { router.push(href); return; }
  main.classList.remove("page-slide-left", "page-slide-right");
  main.classList.add(exitClass);
  setTimeout(() => {
    router.push(href);
    setTimeout(() => main.classList.remove(exitClass), 100);
  }, SLIDE_MS - 40);
}

// ─── MobileNav ────────────────────────────────────────────────────────────
export function MobileNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [activePill, setActivePill] = useState<"market" | "watchlist">(
    pathname === "/watchlist" ? "watchlist" : "market"
  );

  useEffect(() => {
    setActivePill(pathname === "/watchlist" ? "watchlist" : "market");
  }, [pathname]);

  const showNav = pathname === "/" || pathname === "/watchlist";
  if (!showNav) return null;

  const isMarket    = activePill === "market";
  const isWatchlist = activePill === "watchlist";

  function navigateTo(href: "/" | "/watchlist") {
    const goingToWatchlist = href === "/watchlist";
    const currentIsMarket  = pathname === "/";
    if ((goingToWatchlist && !currentIsMarket) || (!goingToWatchlist && currentIsMarket)) return;
    setActivePill(goingToWatchlist ? "watchlist" : "market");
    slideAndNavigate(router, href, goingToWatchlist ? "page-slide-left" : "page-slide-right");
  }

  function handleSearchNavigate(symbol: string) {
    // Mark that we're going to a stock page from search
    markNavigatedFromSearch();
    // Navigate immediately — the search overlay stays mounted and visible
    // as the loading screen while the stock page fetches
    router.push(`/stock/${symbol}`);
    // Dismiss overlay after stock page starts rendering
    setTimeout(() => setSearchOpen(false), 50);
  }

  return (
    <>
      {searchOpen && (
        <MobileSearchOverlay
          onClose={() => setSearchOpen(false)}
          onNavigate={handleSearchNavigate}
        />
      )}

      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden items-center px-4 pointer-events-none"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))", paddingTop: "1rem" }}
      >
        <div className="flex items-center gap-3 flex-1">
          <button className="flex items-center justify-center pointer-events-auto" onClick={() => navigateTo("/")}>
            <span className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-400",
              isMarket ? "bg-positive" : "bg-black/60 backdrop-blur-md border border-white/20"
            )}>
              <span className={cn("flex h-5 w-5 items-center justify-center shrink-0 transition-colors duration-400", isMarket ? "text-black" : "text-positive")}>
                <GlobeIcon className="h-5 w-5" />
              </span>
              <span className={cn("text-sm font-semibold tracking-wide transition-colors duration-400", isMarket ? "text-black" : "text-positive")}>
                Market
              </span>
            </span>
          </button>

          <button className="flex items-center justify-center pointer-events-auto" onClick={() => navigateTo("/watchlist")}>
            <span className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-400",
              isWatchlist ? "bg-positive" : "bg-black/60 backdrop-blur-md border border-white/20"
            )}>
              <span className={cn("flex h-5 w-5 items-center justify-center shrink-0 transition-colors duration-400", isWatchlist ? "text-black" : "text-positive")}>
                <List className="h-5 w-5" />
              </span>
              <span className={cn("text-sm font-semibold tracking-wide transition-colors duration-400", isWatchlist ? "text-black" : "text-positive")}>
                Watchlist
              </span>
            </span>
          </button>
        </div>

        <button
          className="pointer-events-auto flex items-center justify-center h-11 w-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-positive transition-transform duration-200 active:scale-90"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
      </nav>
    </>
  );
}
