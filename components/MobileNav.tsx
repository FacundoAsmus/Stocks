"use client";

import Link from "next/link";
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

// ─── Search overlay: expands from the search button (bottom-right) ────────
function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Double rAF to ensure the initial (collapsed) state is painted before expanding
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExpanded(true);
        // Focus input after expand animation completes
        setTimeout(() => inputRef.current?.focus(), 320);
      });
    });
  }, []);

  function handleClose() {
    setExpanded(false);
    setTimeout(onClose, 300);
  }

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { results?: Array<{ symbol: string; description: string }> };
      setResults((data.results ?? []).slice(0, 8).map(r => ({ symbol: r.symbol, name: r.description })));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }

  return (
    <div
      className="fixed z-50 overflow-hidden bg-black/96 backdrop-blur-xl"
      style={{
        // Always anchored to bottom-right. Animate width/height + border-radius.
        bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        right: "1rem",
        // Collapsed: same size as the search button
        width:  expanded ? "100vw"  : "2.75rem",
        height: expanded ? "100dvh" : "2.75rem",
        borderRadius: expanded ? "0px" : "50%",
        // Grow toward top-left from the bottom-right corner
        transformOrigin: "bottom right",
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        // When fully expanded, align to true screen edges
        ...(expanded ? { bottom: 0, right: 0 } : {}),
      }}
    >
      {/* Content fades in after the circle is big enough */}
      <div
        className="flex flex-col h-full"
        style={{
          opacity: expanded ? 1 : 0,
          transition: "opacity 150ms ease",
          transitionDelay: expanded ? "160ms" : "0ms",
        }}
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 pt-14 pb-4">
          <Search className="h-5 w-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => search(e.target.value)}
            placeholder="Search stocks…"
            className="flex-1 bg-transparent text-lg text-text-primary placeholder:text-text-muted outline-none"
          />
          <button onClick={handleClose} className="text-text-muted active:text-text-primary p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-sm text-text-muted">Searching…</p>}
          {results.map(r => (
            <button
              key={r.symbol}
              className="w-full flex items-center gap-3 px-4 py-4 border-b border-border-subtle/40 text-left active:bg-panel-muted"
              onClick={() => { sessionStorage.setItem('nav-from-search', '1'); router.push(`/stock/${r.symbol}`); /* DO NOT close overlay — loading screen covers it */ }}
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
          {!loading && query && !results.length && (
            <p className="px-4 py-6 text-sm text-text-muted">No results for &ldquo;{query}&rdquo;</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page-slide helpers ───────────────────────────────────────────────────
// The strategy: apply the exit animation to <main>, WAIT for it to finish
// (so the loading skeleton slides in as part of the same motion), then push
// the route. The new page's loading.tsx gets the enter-slide class so it
// appears to arrive from the correct side.

const SLIDE_DURATION = 260; // must match CSS animation duration

function slideAndNavigate(
  router: ReturnType<typeof useRouter>,
  href: "/" | "/watchlist",
  exitClass: "page-slide-left" | "page-slide-right",
) {
  const main = document.querySelector("main");
  if (!main) { router.push(href); return; }

  // Remove any stale class first
  main.classList.remove("page-slide-left", "page-slide-right", "page-enter-left", "page-enter-right");

  // Kick off exit animation
  main.classList.add(exitClass);

  // Navigate once the exit animation has had time to complete
  setTimeout(() => {
    router.push(href);
    // Clean up exit class after navigation settles
    setTimeout(() => {
      main.classList.remove(exitClass);
    }, 100);
  }, SLIDE_DURATION - 20); // slightly before end so there's no gap
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  const [activePill, setActivePill] = useState<"market" | "watchlist">(
    pathname === "/watchlist" ? "watchlist" : "market"
  );

  useEffect(() => {
    setActivePill(pathname === "/watchlist" ? "watchlist" : "market");
    // Re-open search if we navigated back from a search-opened stock page
    if (typeof window !== "undefined" && sessionStorage.getItem("reopen-search")) {
      sessionStorage.removeItem("reopen-search");
      setSearchOpen(true);
    }
  }, [pathname]);

  const showNav = pathname === "/" || pathname === "/watchlist";
  if (!showNav) return null;

  const isMarket    = activePill === "market";
  const isWatchlist = activePill === "watchlist";

  function navigateTo(href: "/" | "/watchlist") {
    const goingToWatchlist = href === "/watchlist";
    const currentIsMarket  = pathname === "/";
    const alreadyThere = (goingToWatchlist && !currentIsMarket) || (!goingToWatchlist && currentIsMarket);
    if (alreadyThere) return;

    // Animate pill immediately so it switches in sync with the swipe
    setActivePill(goingToWatchlist ? "watchlist" : "market");

    // Market is RIGHT of Watchlist:
    //   going to watchlist → current slides LEFT
    //   going to market    → current slides RIGHT
    const exitClass = goingToWatchlist ? "page-slide-left" : "page-slide-right";
    slideAndNavigate(router, href, exitClass);
  }

  return (
    <>
      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}

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

        {/* Search circle — this is the origin point of the expand animation */}
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
