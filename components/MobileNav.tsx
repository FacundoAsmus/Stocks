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

// ─── Search overlay: pill expands to fill screen ─────────────────────────
function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger expand animation on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 350);
      });
    });
  }, []);

  function handleClose() {
    setExpanded(false);
    setTimeout(onClose, 350);
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
      className={cn(
        "fixed z-50 bg-black/95 backdrop-blur-xl transition-all ease-in-out overflow-hidden",
        // Start: small pill at bottom-right, End: full screen
        expanded
          ? "inset-0 rounded-none duration-350"
          : "bottom-6 right-4 h-11 w-11 rounded-full duration-350"
      )}
      style={{
        transitionDuration: "350ms",
        // When collapsed, match the search button position exactly
        ...(expanded ? {} : {
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        }),
      }}
    >
      {/* Content only visible once expanded enough */}
      <div className={cn(
        "flex flex-col h-full transition-opacity duration-200",
        expanded ? "opacity-100 delay-200" : "opacity-0"
      )}>
        {/* Search bar row */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 pt-12 pb-4">
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

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-sm text-text-muted">Searching…</p>}
          {results.map(r => (
            <button
              key={r.symbol}
              className="w-full flex items-center gap-3 px-4 py-4 border-b border-border-subtle/40 text-left active:bg-panel-muted"
              onClick={() => { handleClose(); setTimeout(() => router.push(`/stock/${r.symbol}`), 360); }}
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

// ─── Page transition context ──────────────────────────────────────────────
// We intercept nav clicks and apply CSS animations before the route changes.
// Market (/) is conceptually to the RIGHT of Watchlist (/watchlist).
// So: Market → Watchlist = slide right-to-left; Watchlist → Market = slide left-to-right.

type NavAnim = "slide-left" | "slide-right" | "none";

// We store the pending animation in module scope so the page layout can read it
let pendingAnimation: NavAnim = "none";
export function getPendingAnimation() { return pendingAnimation; }
export function clearPendingAnimation() { pendingAnimation = "none"; }

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  // Track which pill is "active" independently so we can animate it during transition
  const [activePill, setActivePill] = useState<"market" | "watchlist">(
    pathname === "/watchlist" ? "watchlist" : "market"
  );

  // Sync activePill when pathname settles
  useEffect(() => {
    setActivePill(pathname === "/watchlist" ? "watchlist" : "market");
  }, [pathname]);

  const showNav = pathname === "/" || pathname === "/watchlist";
  if (!showNav) return null;

  const isMarket    = activePill === "market";
  const isWatchlist = activePill === "watchlist";

  function navigateTo(href: string) {
    const goingToWatchlist = href === "/watchlist";
    const currentIsMarket  = pathname === "/";

    // Determine swipe direction:
    // Market is RIGHT of Watchlist. Going TO watchlist FROM market = slide left.
    // Going TO market FROM watchlist = slide right.
    const anim: NavAnim = goingToWatchlist && currentIsMarket
      ? "slide-left"
      : !goingToWatchlist && !currentIsMarket
        ? "slide-right"
        : "none";

    if (anim === "none") return; // already on this page

    // Animate pill immediately
    setActivePill(goingToWatchlist ? "watchlist" : "market");

    // Apply page animation class
    const main = document.querySelector("main");
    if (main) {
      main.classList.remove("page-slide-left", "page-slide-right");
      main.classList.add(anim === "slide-left" ? "page-slide-left" : "page-slide-right");
      setTimeout(() => {
        router.push(href);
        setTimeout(() => main.classList.remove("page-slide-left", "page-slide-right"), 400);
      }, 50);
    } else {
      router.push(href);
    }
  }

  return (
    <>
      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}

      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden items-center px-4 py-4 pointer-events-none"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        {/* Pills */}
        <div className="flex items-center gap-3 flex-1">
          {/* Market pill */}
          <button
            className="flex items-center justify-center pointer-events-auto"
            onClick={() => navigateTo("/")}
          >
            <span className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300",
              isMarket ? "bg-positive" : "bg-black/60 backdrop-blur-md border border-white/20"
            )}>
              <span className={cn("flex h-5 w-5 items-center justify-center shrink-0 transition-colors duration-300", isMarket ? "text-black" : "text-positive")}>
                <GlobeIcon className="h-5 w-5" />
              </span>
              <span className={cn("text-sm font-semibold tracking-wide transition-colors duration-300", isMarket ? "text-black" : "text-positive")}>
                Market
              </span>
            </span>
          </button>

          {/* Watchlist pill */}
          <button
            className="flex items-center justify-center pointer-events-auto"
            onClick={() => navigateTo("/watchlist")}
          >
            <span className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300",
              isWatchlist ? "bg-positive" : "bg-black/60 backdrop-blur-md border border-white/20"
            )}>
              <span className={cn("flex h-5 w-5 items-center justify-center shrink-0 transition-colors duration-300", isWatchlist ? "text-black" : "text-positive")}>
                <List className="h-5 w-5" />
              </span>
              <span className={cn("text-sm font-semibold tracking-wide transition-colors duration-300", isWatchlist ? "text-black" : "text-positive")}>
                Watchlist
              </span>
            </span>
          </button>
        </div>

        {/* Search circle */}
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
