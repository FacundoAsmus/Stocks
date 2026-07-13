"use client";

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
  const [closing, setClosing] = useState(false);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 220);
  }

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
      style={{ animation: closing ? "settingsFadeOut 0.22s ease both" : "settingsFadeIn 0.2s ease both" }}
    >
      {/* Fixed header with blur */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border-subtle px-4 pt-14 pb-4 flex flex-col gap-3">
        <button
          onClick={handleClose}
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
        @keyframes settingsFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(10px); }
        }
      `}</style>
    </div>
  );
}

// ─── Search pill — mirrors the AI chat pill exactly: same size, position,
// easing, and morph-from-circle-to-bar behaviour. Results appear in a
// translucent rounded box that grows upward from the bar, closest match
// nearest the bar. ──────────────────────────────────────────────────────
function MobileSearchPill({ origin }: { origin: string }) {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [logos, setLogos]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [vp, setVp] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const inputRef   = useRef<HTMLInputElement>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  // Track visual viewport (handles iOS keyboard shrinking the screen) — same
  // pattern as the AI chat pill.
  useEffect(() => {
    function update() {
      const vv = window.visualViewport;
      setVp(vv
        ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
      );
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Lock body scroll (without jumping to top) only while search is open
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const b = document.body;
    b.style.overflow = "hidden";
    b.style.position = "fixed";
    b.style.top      = `-${scrollY}px`;
    b.style.left     = "0";
    b.style.right    = "0";
    const t = setTimeout(() => inputRef.current?.focus(), 340);
    return () => {
      clearTimeout(t);
      b.style.overflow = b.style.position = b.style.top = b.style.left = b.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLogos({}); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json() as { results?: Array<{ symbol: string; description: string }> };
        const newResults = (data.results ?? []).slice(0, 8).map(r => ({ symbol: r.symbol, name: r.description }));
        setResults(newResults);
        // Fetch logos in batch for the result symbols
        if (newResults.length) {
          const symbols = newResults.map(r => r.symbol).join(",");
          const stockRes = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal });
          const stockData = await stockRes.json() as { stocks?: Array<{ symbol: string; logo?: string }> };
          const logoMap: Record<string, string> = {};
          for (const s of stockData.stocks ?? []) {
            if (s.logo) logoMap[s.symbol] = s.logo;
          }
          if (!controller.signal.aborted) setLogos(logoMap);
        }
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { controller.abort(); clearTimeout(t); };
  }, [query]);

  function handleDismiss() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setLogos({});
  }

  function goToSymbol(symbol: string) {
    sessionStorage.setItem("nav-from-search", "1");
    sessionStorage.setItem("search-origin", origin);
    handleDismiss();
    router.push(`/stock/${symbol}`);
  }

  // Tap-to-dismiss on empty space, identical pattern to the AI chat's messages area
  function onEmptyAreaTouchStart(e: React.TouchEvent) {
    if (e.target !== e.currentTarget) { touchStart.current = null; return; }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  }
  function onEmptyAreaTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    const dt = Date.now() - touchStart.current.time;
    if (dx < 8 && dy < 8 && dt < 300) handleDismiss();
    touchStart.current = null;
  }
  function onEmptyAreaClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleDismiss();
  }

  const vpW = vp.width  || (typeof window !== "undefined" ? window.innerWidth  : 0);
  const vpH = vp.height || (typeof window !== "undefined" ? window.innerHeight : 0);
  const winH = typeof window !== "undefined" ? window.innerHeight : 0;
  const keyboardInset = Math.max(0, winH - vpH - vp.top);
  const pillBottom = open && keyboardInset > 8
    ? `${keyboardInset + 12}px`
    : "calc(1.25rem + env(safe-area-inset-bottom))";

  const showDropdown = open && (loading || results.length > 0 || query.trim().length > 0);

  return (
    <>
      {/* Backdrop — pinned to the exact visual viewport rectangle, tap dismisses */}
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          top: vp.top, left: vp.left, width: vpW, height: vpH,
          zIndex: 1000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.28s ease",
        }}
        onClick={handleDismiss}
      >
        <div style={{
          position: "absolute", inset: 0,
          backdropFilter:       open ? "blur(3px) brightness(0.97)" : "none",
          WebkitBackdropFilter: open ? "blur(3px) brightness(0.97)" : "none",
          transition: "backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          willChange: "backdrop-filter",
        }} />
      </div>

      {/* Results — translucent rounded box, grows upward from the bar. Item 0
          (closest match) renders nearest the bar via column-reverse. */}
      {showDropdown && (
        <div
          className="fixed lg:hidden rounded-2xl bg-black/40 backdrop-blur-md border border-white/20"
          style={{
            zIndex: 1001,
            right: "1rem",
            width: "calc(100vw - 2rem)",
            bottom: `calc(${pillBottom} + 3.5rem + 0.75rem)`,
            maxHeight: "55vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column-reverse",
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.22s ease, transform 0.22s ease",
          }}
          onClick={onEmptyAreaClick}
          onTouchStart={onEmptyAreaTouchStart}
          onTouchEnd={onEmptyAreaTouchEnd}
        >
          {loading && (
            <p style={{ padding: "16px 18px", fontSize: 13, color: "var(--color-text-muted)" }}>Searching…</p>
          )}
          {!loading && query.trim() && !results.length && (
            <p style={{ padding: "16px 18px", fontSize: 13, color: "var(--color-text-muted)" }}>No results for &ldquo;{query}&rdquo;</p>
          )}
          {!loading && results.map(r => (
            <button
              key={r.symbol}
              onClick={() => goToSymbol(r.symbol)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                width: "100%",
                textAlign: "left",
                borderTop: "1px solid var(--color-border-subtle)",
              }}
            >
              {logos[r.symbol] ? (
                <img
                  src={logos[r.symbol]}
                  alt=""
                  style={{
                    height: 40, width: 40, borderRadius: 10, flexShrink: 0,
                    border: "1px solid var(--color-border-subtle)",
                    backgroundColor: "var(--color-panel-muted)",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <span style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 40, width: 40, borderRadius: 10, flexShrink: 0,
                  border: "1px solid var(--color-border-subtle)",
                  backgroundColor: "var(--color-panel-muted)",
                  fontSize: 11, fontWeight: 700, color: "var(--color-text-primary)",
                }}>
                  {r.symbol.replace("^", "").slice(0, 2)}
                </span>
              )}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{r.symbol}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* The pill — same element morphs from a small circle into the search
          bar, identical geometry/easing/timing to the AI chat pill. */}
      <div
        className="fixed lg:hidden rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-positive overflow-hidden"
        style={{
          zIndex: 1002,
          bottom: pillBottom,
          right: open ? "1rem" : "1.25rem",
          width: open ? "calc(100vw - 2rem)" : "3.5rem",
          height: "3.5rem",
          transition: "width 0.32s cubic-bezier(0.2,0,0,1), right 0.32s cubic-bezier(0.2,0,0,1), bottom 0.2s ease",
        }}
      >
        {/* Closed state: search icon */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Search"
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: open ? 0 : 1,
            pointerEvents: open ? "none" : "auto",
            transition: "opacity 0.16s ease",
          }}
        >
          <Search className="h-7 w-7" />
        </button>

        {/* Open state: the actual search input row */}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 8px 0 20px",
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transition: "opacity 0.22s ease",
            transitionDelay: open ? "0.14s" : "0s",
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stocks…"
            className="text-text-primary placeholder:text-text-muted"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, caretColor: "#00c805" }}
          />
          <button
            onClick={handleDismiss}
            aria-label="Close search"
            style={{
              flexShrink: 0, height: 38, width: 38,
              borderRadius: "50%",
              backgroundColor: "#00c805",
              color: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none",
              cursor: "pointer",
            }}
          >
            <X style={{ height: 16, width: 16 }} />
          </button>
        </div>
      </div>
    </>
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

      {/* Search — self-contained pill, same behaviour as the AI chat pill */}
      <MobileSearchPill origin={pathname} />
    </>
  );
}
