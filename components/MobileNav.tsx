"use client";

import Link from "next/link";
import { List, Search, Settings, X, ChevronLeft, Monitor, Sun, Moon } from "lucide-react";
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

// ─── Theme management ─────────────────────────────────────────────────────
type Theme = "dark" | "light" | "system";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as Theme) ?? "dark";
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  html.classList.toggle("light-mode", !isDark);
  localStorage.setItem("theme", theme);
}

// ─── Settings panel ───────────────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [proMode, setProMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-mode") === "1" : false
  );

  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
    window.location.reload();
  }

  function toggleProMode() {
    const next = !proMode;
    setProMode(next);
    localStorage.setItem("pro-mode", next ? "1" : "0");
    window.dispatchEvent(new Event("pro-mode-changed"));
  }

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "dark",   label: "Dark",   icon: <Moon className="h-4 w-4" /> },
    { value: "light",  label: "Light",  icon: <Sun className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{ animation: "settingsFadeIn 0.2s ease both" }}
    >
      {/* Fixed header with blur */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border-subtle px-4 pt-14 pb-4 flex flex-col gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg self-start"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="text-2xl font-bold text-text-primary">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">
        {/* Appearance */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-3">Appearance</p>
          <div className="rounded-xl border border-border-subtle bg-panel overflow-hidden divide-y divide-border-subtle">
            {themeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeTheme(opt.value)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <span className="flex items-center gap-3 text-sm text-text-primary">
                  <span className="text-text-muted">{opt.icon}</span>
                  {opt.label} Mode
                </span>
                <span className={cn(
                  "h-5 w-5 rounded-full border-2 transition-colors",
                  theme === opt.value ? "border-positive bg-positive" : "border-border-subtle"
                )} />
              </button>
            ))}
          </div>
        </section>

        {/* Pro Mode */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-3">Pro Mode</p>
          <div className="rounded-xl border border-border-subtle bg-panel overflow-hidden">
            <button
              onClick={toggleProMode}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-text-primary font-medium">Horizontal crosshair</span>
                <span className="text-xs text-text-muted">Adds a horizontal line at the hovered price to identify floors and ceilings</span>
              </span>
              <span className="ml-4 shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative"
                style={{ borderColor: proMode ? "var(--color-positive)" : "var(--color-border-subtle)",
                         backgroundColor: proMode ? "var(--color-positive)" : "var(--color-panel-muted)" }}>
                <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
                  style={{ left: proMode ? "calc(100% - 1.125rem)" : "0.125rem" }} />
              </span>
            </button>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Search overlay ───────────────────────────────────────────────────────
function MobileSearchOverlay({ onClose, origin }: { onClose: () => void; origin: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExpanded(true);
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
        bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        right: "1rem",
        width:  expanded ? "100vw"  : "3.25rem",
        height: expanded ? "100dvh" : "3.25rem",
        borderRadius: expanded ? "0px" : "50%",
        transformOrigin: "bottom right",
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), height 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        ...(expanded ? { bottom: 0, right: 0 } : {}),
      }}
    >
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
          {/* Close button: black X on green bg */}
          <button
            onClick={handleClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-positive text-black active:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-sm text-text-muted">Searching…</p>}
          {results.map(r => (
            <button
              key={r.symbol}
              className="w-full flex items-center gap-3 px-4 py-4 border-b border-border-subtle text-left active:bg-panel-muted"
              onClick={() => {
                sessionStorage.setItem("nav-from-search", "1");
                sessionStorage.setItem("search-origin", origin);
                onClose();
                router.push(`/stock/${r.symbol}`);
              }}
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

// ─── Slide helpers ────────────────────────────────────────────────────────
const SLIDE_DURATION = 260;

function slideAndNavigate(
  router: ReturnType<typeof useRouter>,
  href: "/" | "/watchlist",
  exitClass: "page-slide-left" | "page-slide-right",
) {
  const main = document.querySelector("main");
  if (!main) { router.push(href); return; }
  main.classList.remove("page-slide-left", "page-slide-right", "page-enter-left", "page-enter-right");
  main.classList.add(exitClass);
  setTimeout(() => {
    router.push(href);
    setTimeout(() => main.classList.remove(exitClass), 100);
  }, SLIDE_DURATION - 20);
}

// ─── Main MobileNav ───────────────────────────────────────────────────────
export function MobileNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePill,   setActivePill]   = useState<"market" | "watchlist">(
    pathname === "/watchlist" ? "watchlist" : "market"
  );

  useEffect(() => {
    setActivePill(pathname === "/watchlist" ? "watchlist" : "market");
    // Reopen search only if flagged (back from search-opened stock)
    if (typeof window !== "undefined" && sessionStorage.getItem("reopen-search")) {
      sessionStorage.removeItem("reopen-search");
      // Don't reopen — spec says we DON'T reopen on back
    }
  }, [pathname]);

  // Apply stored theme on mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const showNav = pathname === "/" || pathname === "/watchlist";
  if (!showNav) return null;

  const isMarket    = activePill === "market";
  const isWatchlist = activePill === "watchlist";

  function navigateTo(href: "/" | "/watchlist") {
    const goingToWatchlist = href === "/watchlist";
    const currentIsMarket  = pathname === "/";
    const alreadyThere = (goingToWatchlist && !currentIsMarket) || (!goingToWatchlist && currentIsMarket);
    if (alreadyThere) return;
    setActivePill(goingToWatchlist ? "watchlist" : "market");
    const exitClass = goingToWatchlist ? "page-slide-left" : "page-slide-right";
    slideAndNavigate(router, href, exitClass);
  }

  // Shared pill style
  function pillClass(active: boolean) {
    return cn(
      "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 pointer-events-auto",
      active
        ? "bg-positive"
        : "bg-black/40 backdrop-blur-md border border-white/20"
    );
  }
  function iconClass(active: boolean) {
    return cn("transition-colors duration-300", active ? "text-black" : "text-positive");
  }

  return (
    <>
      {searchOpen   && <MobileSearchOverlay onClose={() => setSearchOpen(false)}   origin={pathname} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Three pills: Market, Watchlist, Settings — left-grouped */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 flex lg:hidden items-center justify-start gap-3 px-5 pointer-events-none"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))", paddingTop: "1rem" }}
      >
        <button className={pillClass(isMarket)} onClick={() => navigateTo("/")}>
          <GlobeIcon className={cn("h-6 w-6", iconClass(isMarket))} />
        </button>

        <button className={pillClass(isWatchlist)} onClick={() => navigateTo("/watchlist")}>
          <List className={cn("h-6 w-6", iconClass(isWatchlist))} />
        </button>

        <button className={pillClass(false)} onClick={() => setSettingsOpen(true)}>
          <Settings className="h-6 w-6 text-positive" />
        </button>
      </nav>

      {/* Search — fixed to bottom-right corner, aligned with device radius */}
      <button
        className="fixed z-40 lg:hidden pointer-events-auto flex items-center justify-center h-14 w-14 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-positive transition-transform duration-200 active:scale-90"
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
        }}
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
      >
        <Search className="h-7 w-7" />
      </button>
    </>
  );
}
