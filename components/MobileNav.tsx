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

// ─── Module-level flag: did we navigate to a stock page from search? ──────
// This lets MobileStockPage know to reverse-collapse the search circle on back.
export let navigatedFromSearch = false;
export function setNavigatedFromSearch(v: boolean) { navigatedFromSearch = v; }

// ─── Search overlay ───────────────────────────────────────────────────────
// Expands from the search button position (bottom-right corner).
// When a result is tapped: navigate immediately (search stays visible as a
// full-screen overlay during the stock page load). The stock page's back
// button will then collapse this overlay instead of doing the sink animation.

interface SearchOverlayProps {
  onClose: () => void;
  /** called with the symbol when the user picks a result */
  onNavigate: (symbol: string) => void;
  /** when true, immediately start collapsing (used by stock page back from search) */
  forceCollapse?: boolean;
}

export function MobileSearchOverlay({ onClose, onNavigate, forceCollapse }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expand on mount (skip if forceCollapse — start already expanded, collapse immediately)
  useEffect(() => {
    if (forceCollapse) {
      // Already should appear expanded; we'll collapse via the forceCollapse effect below
      setExpanded(true);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)));
  }, [forceCollapse]);

  // Trigger collapse when forceCollapse becomes true
  useEffect(() => {
    if (forceCollapse) {
      // Small delay so it renders expanded first, then collapses
      const t = setTimeout(() => {
        setExpanded(false);
        setTimeout(onClose, 700);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [forceCollapse, onClose]);

  // Focus keyboard once fully expanded (not when collapsing)
  useEffect(() => {
    if (expanded && !forceCollapse) {
      const t = setTimeout(() => inputRef.current?.focus(), 720);
      return () => clearTimeout(t);
    }
  }, [expanded, forceCollapse]);

  /** Collapse and then call onClose */
  function collapse(cb?: () => void) {
    setExpanded(false);
    setTimeout(() => { onClose(); cb?.(); }, 700);
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
      {/* Content fades in after the circle is big enough */}
      <div
        className="flex flex-col h-full"
        style={{
          opacity: expanded ? 1 : 0,
          transition: "opacity 250ms ease",
          transitionDelay: expanded ? "420ms" : "0ms",
          pointerEvents: expanded ? "auto" : "none",
        }}
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 pt-14 pb-4">
          <Search className="h-5 w-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => doSearch(e.target.value)}
            placeholder="Search stocks…"
            className="flex-1 bg-transparent text-lg text-text-primary placeholder:text-text-muted outline-none"
          />
          <button onClick={() => collapse()} className="text-text-muted active:text-text-primary p-1">
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
  const pathname = usePathname();
  const router   = useRouter();
  const [searchOpen, setSearchOpen]     = useState(false);
  const [activePill, setActivePill]     = useState<"market" | "watchlist">(
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
    // Mark that next stock page was opened via search
    setNavigatedFromSearch(true);
    // Navigate immediately — the search overlay stays mounted and acts as the
    // "loading screen" visual while the stock page loads behind it.
    router.push(`/stock/${symbol}`);
    // Close the overlay after enough time for the stock page to start rendering
    // (it will appear under/through the overlay gracefully)
    setTimeout(() => setSearchOpen(false), 800);
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
