"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { SECTOR_ETFS } from "@/lib/etfs";
import { StockLogo } from "@/components/StockLogo";
import { GlossyCloseIcon, GlossyIconButton } from "@/components/GlossyIconButton";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

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
  // Keep Safari's status-bar/dynamic-island color matching the app's actual
  // resolved theme — not the OS's — so a light-mode page never shows a
  // stray gray/dark bar just because the phone itself is set to dark mode.
}

// ─── Settings panel ───────────────────────────────────────────────────────
export function MobileSettingsPanel({ closing, onClose, origin }: { closing: boolean; onClose: () => void; origin: { x: number; y: number } }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [proMode, setProMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-mode") === "1" : false
  );
  const [showVolumeChart, setShowVolumeChart] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-volume-chart") !== "0" : true
  );
  const [useCandlesticks, setUseCandlesticks] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("chart-style") === "candles" : false
  );
  const [colorVolumeBars, setColorVolumeBars] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-volume-color-bars") === "1" : false
  );
  const [showAlertLines, setShowAlertLines] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-alert-lines") === "1" : false
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

  function toggleVolumeChart() {
    const next = !showVolumeChart;
    setShowVolumeChart(next);
    localStorage.setItem("pro-volume-chart", next ? "1" : "0");
    window.dispatchEvent(new Event("pro-volume-chart-changed"));
  }

  function toggleCandlesticks() {
    const next = !useCandlesticks;
    setUseCandlesticks(next);
    localStorage.setItem("chart-style", next ? "candles" : "line");
    window.dispatchEvent(new Event("chart-style-changed"));
  }

  function toggleVolumeBarColors() {
    const next = !colorVolumeBars;
    setColorVolumeBars(next);
    localStorage.setItem("pro-volume-color-bars", next ? "1" : "0");
    window.dispatchEvent(new Event("pro-volume-color-bars-changed"));
  }

  function toggleAlertLines() {
    const next = !showAlertLines;
    setShowAlertLines(next);
    localStorage.setItem("pro-alert-lines", next ? "1" : "0");
    window.dispatchEvent(new Event("pro-alert-lines-changed"));
  }


  const themeOptions: { value: Theme; label: string; iconName: string }[] = [
    { value: "dark",   label: "Dark",   iconName: "theme-dark" },
    { value: "light",  label: "Light",  iconName: "theme-light" },
    { value: "system", label: "System", iconName: "theme-system" },
  ];
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const transformOrigin = `${origin.x}px ${origin.y - viewportHeight * 0.06}px`;

  return (
    <div
      className="smoked-glass-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:hidden"
      style={{ background: "rgba(0,0,0,0.16)", backdropFilter: "blur(12px) brightness(0.97)", WebkitBackdropFilter: "blur(12px) brightness(0.97)" }}
    >
      <div
        className="earnings-detail-glass smoked-glass-surface smoked-glass-calendar flex w-full max-w-lg flex-col rounded-3xl border border-white/15"
        style={{
          height: "min(88dvh, 880px)",
          transformOrigin,
          background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)",
          animation: closing
            ? "mobileSettingsSink 0.3s cubic-bezier(0.4,0,1,1) forwards"
            : "mobileSettingsRise 0.32s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">Settings</h2>
          <GlossyIconButton aria-label="Close settings" onClick={onClose}><GlossyCloseIcon /></GlossyIconButton>
        </div>

      <div
        className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pt-2 pb-8"
      >
        {/* Appearance */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">Appearance</p>
          <div className="rounded-3xl border border-border-subtle bg-panel overflow-hidden divide-y divide-border-subtle">
            {themeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeTheme(opt.value)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <span className="flex items-center gap-3 text-sm text-text-primary">
                  <OptionalSvgIcon name={opt.iconName} className="h-4 w-4" colorClassName={theme === opt.value ? "text-accent" : "text-text-muted"} />
                  {opt.label} Mode
                </span>
                <span className={cn(
                  "h-5 w-5 rounded-full border-2 transition-colors",
                  theme === opt.value ? "border-accent bg-accent" : "border-border-subtle"
                )} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-3">Pro Features</p>
          <div className="rounded-3xl border border-border-subtle bg-panel overflow-hidden">
            <button onClick={toggleProMode} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
              <span className="flex items-center gap-3"><OptionalSvgIcon name="horizontal-crosshair" className="h-5 w-5" colorClassName={proMode ? "text-accent" : "text-text-muted"} /><span className="text-sm text-text-primary font-medium">Horizontal crosshair</span></span>
              <span className="ml-4 shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative" style={{ borderColor: proMode ? "var(--color-accent)" : "var(--color-border-subtle)", backgroundColor: proMode ? "var(--color-accent)" : "var(--color-panel-muted)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200" style={{ left: proMode ? "calc(100% - 1.125rem)" : "0.125rem" }} /></span>
            </button>
            <button onClick={toggleCandlesticks} className="w-full flex items-center justify-between px-4 py-3.5 text-left border-t border-border-subtle">
              <span className="flex items-center gap-3"><OptionalSvgIcon name="candlestick-chart" className="h-5 w-5" colorClassName={useCandlesticks ? "text-accent" : "text-text-muted"} /><span className="text-sm text-text-primary font-medium">Candlestick chart</span></span>
              <span className="ml-4 shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative" style={{ borderColor: useCandlesticks ? "var(--color-accent)" : "var(--color-border-subtle)", backgroundColor: useCandlesticks ? "var(--color-accent)" : "var(--color-panel-muted)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200" style={{ left: useCandlesticks ? "calc(100% - 1.125rem)" : "0.125rem" }} /></span>
            </button>
            <button onClick={toggleVolumeChart} className="w-full flex items-center justify-between px-4 py-3.5 text-left border-t border-border-subtle">
              <span className="flex items-center gap-3"><OptionalSvgIcon name="volume-chart" className="h-5 w-5" colorClassName={showVolumeChart ? "text-accent" : "text-text-muted"} /><span className="text-sm text-text-primary font-medium">Volume chart</span></span>
              <span className="ml-4 shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative" style={{ borderColor: showVolumeChart ? "var(--color-accent)" : "var(--color-border-subtle)", backgroundColor: showVolumeChart ? "var(--color-accent)" : "var(--color-panel-muted)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200" style={{ left: showVolumeChart ? "calc(100% - 1.125rem)" : "0.125rem" }} /></span>
            </button>
            <button onClick={toggleVolumeBarColors} disabled={!showVolumeChart} className="w-full flex items-center justify-between px-4 py-3.5 text-left border-t border-border-subtle transition-opacity disabled:opacity-35 disabled:cursor-not-allowed">
              <span className="flex items-center gap-3"><OptionalSvgIcon name="color-bars" className="h-5 w-5" colorClassName={colorVolumeBars ? "text-accent" : "text-text-muted"} /><span className="text-sm text-text-primary font-medium">Color bars</span></span>
              <span className="ml-4 shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative" style={{ borderColor: colorVolumeBars ? "var(--color-accent)" : "var(--color-border-subtle)", backgroundColor: colorVolumeBars ? "var(--color-accent)" : "var(--color-panel-muted)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200" style={{ left: colorVolumeBars ? "calc(100% - 1.125rem)" : "0.125rem" }} /></span>
            </button>
            <button onClick={toggleAlertLines} className="w-full flex items-center justify-between px-4 py-3.5 text-left border-t border-border-subtle">
              <span className="flex items-center gap-3"><OptionalSvgIcon name="alert-price-lines" className="h-5 w-5" colorClassName={showAlertLines ? "text-accent" : "text-text-muted"} /><span className="text-sm text-text-primary font-medium">Alert price lines</span></span>
              <span className="ml-4 shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative" style={{ borderColor: showAlertLines ? "var(--color-accent)" : "var(--color-border-subtle)", backgroundColor: showAlertLines ? "var(--color-accent)" : "var(--color-panel-muted)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200" style={{ left: showAlertLines ? "calc(100% - 1.125rem)" : "0.125rem" }} /></span>
            </button>
          </div>
        </section>
      </div>
      </div>
      <style>{`
        @keyframes mobileSettingsRise {
          from { transform: scale(0.08); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes mobileSettingsSink {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(0.08); opacity: 0; }
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

        // Logos are a nice-to-have enrichment, not the search result itself —
        // a failure here (rate limit, a bad symbol in the batch, a network
        // blip) must never clear the real results that already loaded above.
        if (newResults.length) {
          try {
            const symbols = newResults.map(r => r.symbol).join(",");
            const stockRes = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal });
            const stockData = await stockRes.json() as { stocks?: Array<{ symbol: string; logo?: string }> };
            const logoMap: Record<string, string> = {};
            for (const s of stockData.stocks ?? []) {
              if (s.logo) logoMap[s.symbol] = s.logo;
            }
            if (!controller.signal.aborted) setLogos(logoMap);
          } catch { /* logos are optional — results above stay intact either way */ }
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
    window.dispatchEvent(new Event("stock-sheet-capture-page"));
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
    : "calc(env(safe-area-inset-bottom) - 0.5rem)";

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
          className="smoked-glass-surface fixed lg:hidden rounded-3xl border border-white/25"
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
            background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            boxShadow: open
              ? "0 0 14px rgb(var(--accent-rgb) / 0.45), 0 0 5px rgb(var(--accent-rgb) / 0.65), 0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)"
              : "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)",
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
              <StockLogo logo={logos[r.symbol] && !SECTOR_ETFS.some((etf) => etf.symbol === r.symbol) ? logos[r.symbol] : undefined}
                size={48} sizeClassName="h-10 w-10 shrink-0"
                imageClassName="h-10 w-10 shrink-0 rounded-3xl border border-border-subtle bg-panel-muted object-contain"
                fallbackClassName="h-10 w-10 shrink-0 rounded-3xl object-contain" fallbackDisplay="flex" />
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
        className="smoked-glass-surface fixed lg:hidden overflow-hidden rounded-full border border-white/25 text-accent"
        style={{
          zIndex: 1002,
          bottom: pillBottom,
          right: open ? "1rem" : "1.25rem",
          width: open ? "calc(100vw - 2rem)" : "3.5rem",
          height: "3.5rem",
          background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)",
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
          <Search className="h-7 w-7 text-accent" />
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
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, caretColor: "var(--color-accent)" }}
          />
          <GlossyIconButton aria-label="Close search" onClick={handleDismiss} size={38} className="shrink-0">
            <GlossyCloseIcon />
          </GlossyIconButton>
        </div>
      </div>
    </>
  );
}

// ─── Slide helpers ────────────────────────────────────────────────────────
const SLIDE_DURATION = 260;
const SETTINGS_DURATION = 300;

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
  const [settingsPhase, setSettingsPhase] = useState<"closed" | "open" | "closing">("closed");
  const [settingsOrigin, setSettingsOrigin] = useState({ x: 0, y: 0 });
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

  const isWatchlist = activePill === "watchlist";
  const activeIndex = settingsPhase !== "closed" ? 2 : (isWatchlist ? 1 : 0);
  const BUBBLE_SIZE = "3.5rem"; // matches the search pill's h-14 exactly

  function navigateTo(href: "/" | "/watchlist") {
    const goingToWatchlist = href === "/watchlist";
    const currentIsMarket  = pathname === "/";
    const alreadyThere = (goingToWatchlist && !currentIsMarket) || (!goingToWatchlist && currentIsMarket);

    if (settingsPhase !== "closed") {
      // Leaving Settings for Market/Watchlist always plays the swipe-right
      // close transition, then (only if actually changing page) navigates.
      setActivePill(goingToWatchlist ? "watchlist" : "market");
      setSettingsPhase("closing");
      setTimeout(() => {
        setSettingsPhase("closed");
        if (!alreadyThere) router.push(href);
      }, SETTINGS_DURATION);
      return;
    }

    if (alreadyThere) return;
    setActivePill(goingToWatchlist ? "watchlist" : "market");
    const exitClass = goingToWatchlist ? "page-slide-left" : "page-slide-right";
    slideAndNavigate(router, href, exitClass);
  }

  function openSettings(event: React.MouseEvent<HTMLButtonElement>) {
    if (settingsPhase !== "closed") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setSettingsOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const main = document.querySelector("main");
    main?.classList.remove("page-slide-left", "page-slide-right");
    main?.classList.add("page-slide-left"); // same "forward" direction as Market → Watchlist
    setTimeout(() => {
      setSettingsPhase("open");
      setTimeout(() => main?.classList.remove("page-slide-left"), 100);
    }, SLIDE_DURATION - 20);
  }

  function closeSettings() {
    if (settingsPhase !== "open") return;
    setSettingsPhase("closing");
    setTimeout(() => setSettingsPhase("closed"), SETTINGS_DURATION);
  }

  const iconWrapClass = "relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors duration-300";
  function iconClass(active: boolean) {
    return cn("transition-colors duration-300", active ? "text-accent" : "text-text-muted");
  }

  return (
    <>
      {settingsPhase !== "closed" && <MobileSettingsPanel closing={settingsPhase === "closing"} onClose={closeSettings} origin={settingsOrigin} />}

      {/* Bottom dock: navigation stays grouped in the capsule, while search
          keeps its separate circle so it can morph into the existing search bar. */}
      <nav
        className="fixed bottom-0 inset-x-0 z-[60] flex lg:hidden items-center px-5 pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) - 0.5rem)", paddingTop: "1rem" }}
      >
        <div
          className="smoked-glass-surface relative flex h-14 w-[calc(100%-4.25rem)] flex-none items-center rounded-full border border-white/25 overflow-hidden pointer-events-auto"
          style={{
            height: BUBBLE_SIZE,
            marginRight: "0.75rem",
            background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))",
            backdropFilter: "blur(var(--phone-floating-pill-blur))",
            WebkitBackdropFilter: "blur(var(--phone-floating-pill-blur))",
            boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)",
          }}
        >
          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/")}
            aria-label="Market"
          >
            <OptionalSvgIcon name="market" selected={activeIndex === 0} className="h-6 w-6" colorClassName={activeIndex === 0 ? "text-accent" : "text-text-muted"} />
            <span className={cn("text-xs font-medium leading-none", iconClass(activeIndex === 0))}>Market</span>
          </button>

          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/watchlist")}
            aria-label="Watchlist"
          >
            <OptionalSvgIcon name="watchlist" selected={activeIndex === 1} className="h-6 w-6" colorClassName={activeIndex === 1 ? "text-accent" : "text-text-muted"} />
            <span className={cn("text-xs font-medium leading-none", iconClass(activeIndex === 1))}>Watchlist</span>
          </button>

          <button
            className={iconWrapClass}
            onClick={openSettings}
            aria-label="Settings"
          >
            <OptionalSvgIcon name="settings" selected={activeIndex === 2} className="h-6 w-6" colorClassName={activeIndex === 2 ? "text-accent" : "text-text-muted"} />
            <span className={cn("text-xs font-medium leading-none", iconClass(activeIndex === 2))}>Settings</span>
          </button>
        </div>
      </nav>

      {/* Search — self-contained pill, same behaviour as the AI chat pill */}
      <MobileSearchPill origin={pathname} />
    </>
  );
}
