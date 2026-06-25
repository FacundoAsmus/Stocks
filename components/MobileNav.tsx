"use client";

import Link from "next/link";
import { List, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M5 7.5 Q12 5 19 7.5" />
      <path d="M5 16.5 Q12 19 19 16.5" />
      <path d="M12 3 Q7 12 12 21" />
      <path d="M12 3 Q17 12 12 21" />
    </svg>
  );
}

function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

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
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 pt-12 pb-4" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={e => search(e.target.value)}
          placeholder="Search stocks…"
          className="flex-1 bg-transparent text-lg text-text-primary placeholder:text-text-muted outline-none"
        />
        <button onClick={onClose} className="text-text-muted text-sm font-medium px-2 py-1">Cancel</button>
      </div>
      <div className="flex-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading && <p className="px-4 py-6 text-sm text-text-muted">Searching…</p>}
        {results.map(r => (
          <button
            key={r.symbol}
            className="w-full flex items-center gap-3 px-4 py-4 border-b border-border-subtle/40 text-left hover:bg-panel-muted"
            onClick={() => { onClose(); router.push(`/stock/${r.symbol}`); }}
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
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // Only show nav on market and watchlist pages
  const showNav = pathname === "/" || pathname === "/watchlist";
  if (!showNav) return null;

  const isMarket    = pathname === "/";
  const isWatchlist = pathname === "/watchlist";

  return (
    <>
      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}

      <nav className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden items-center px-4 py-3 pointer-events-none" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {/* Left side: Market + Watchlist pills */}
        <div className="flex items-center gap-3 flex-1">
          <Link href="/" className="flex items-center justify-center pointer-events-auto">
            <span className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-full transition-all duration-200",
              isMarket ? "bg-positive" : "bg-black/60 backdrop-blur-md border border-white/20"
            )}>
              <span className={cn("flex h-4 w-4 items-center justify-center shrink-0", isMarket ? "text-black" : "text-positive")}>
                <GlobeIcon className="h-4 w-4" />
              </span>
              <span className={cn("text-xs font-semibold tracking-wide", isMarket ? "text-black" : "text-positive")}>
                Market
              </span>
            </span>
          </Link>

          <Link href="/watchlist" className="flex items-center justify-center pointer-events-auto">
            <span className={cn(
              "flex items-center gap-1.5 px-5 py-2 rounded-full transition-all duration-200",
              isWatchlist ? "bg-positive" : "bg-black/60 backdrop-blur-md border border-white/20"
            )}>
              <span className={cn("flex h-4 w-4 items-center justify-center shrink-0", isWatchlist ? "text-black" : "text-positive")}>
                <List className="h-4 w-4" />
              </span>
              <span className={cn("text-xs font-semibold tracking-wide", isWatchlist ? "text-black" : "text-positive")}>
                Watchlist
              </span>
            </span>
          </Link>
        </div>

        {/* Right side: Search circle */}
        <button
          className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-positive"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </nav>
    </>
  );
}
