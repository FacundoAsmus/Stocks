"use client";

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
  const [activePill,   setActivePill]   = useState<"market" | "watchlist" | "conversations" | "profile">(
    pathname === "/watchlist" ? "watchlist" : pathname === "/conversations" ? "conversations" : pathname === "/profile" ? "profile" : "market"
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string }>>([]);
  const [searchLogos, setSearchLogos] = useState<Record<string, string>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [visualViewport, setVisualViewport] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActivePill(pathname === "/watchlist" ? "watchlist" : pathname === "/conversations" ? "conversations" : pathname === "/profile" ? "profile" : "market");
  }, [pathname]);

  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    window.addEventListener("open-phone-stock-search", openSearch);
    return () => window.removeEventListener("open-phone-stock-search", openSearch);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const savedScroll = window.scrollY;
    const body = document.body;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScroll}px`;
    body.style.left = "0";
    body.style.right = "0";
    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 660);
    return () => {
      window.clearTimeout(focusTimer);
      body.style.overflow = body.style.position = body.style.top = body.style.left = body.style.right = "";
      window.scrollTo(0, savedScroll);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const updateViewport = () => {
      const vv = window.visualViewport;
      setVisualViewport(vv
        ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLogos({});
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, { signal: controller.signal });
        const data = await response.json() as { results?: Array<{ symbol: string; description: string }> };
        const results = (data.results ?? []).slice(0, 8).map(item => ({ symbol: item.symbol, name: item.description }));
        setSearchResults(results);
        if (results.length) {
          try {
            const symbols = results.map(item => item.symbol).join(",");
            const stockResponse = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal });
            const stockData = await stockResponse.json() as { stocks?: Array<{ symbol: string; logo?: string }> };
            const logos: Record<string, string> = {};
            for (const stock of stockData.stocks ?? []) if (stock.logo) logos[stock.symbol] = stock.logo;
            if (!controller.signal.aborted) setSearchLogos(logos);
          } catch { /* stock logos are optional */ }
        }
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [searchQuery]);

  // Apply stored theme on mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const showNav = pathname === "/" || pathname === "/watchlist" || pathname === "/conversations" || pathname === "/profile";
  if (!showNav) return null;

  const isWatchlist = activePill === "watchlist";
  const activeIndex = settingsPhase !== "closed" ? 4 : activePill === "market" ? 0 : activePill === "watchlist" ? 1 : activePill === "conversations" ? 2 : 3;
  const BUBBLE_SIZE = "3.6rem";
  const viewportHeight = visualViewport.height || (typeof window !== "undefined" ? window.innerHeight : 0);
  const keyboardInset = Math.max(0, (typeof window !== "undefined" ? window.innerHeight : 0) - viewportHeight - visualViewport.top);
  const searchBottom = searchOpen && keyboardInset > 8
    ? `calc(${keyboardInset + 12}px - var(--phone-controls-lower))`
    : "calc(env(safe-area-inset-bottom) - 0.5rem - var(--phone-controls-lower))";

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchLogos({});
  }

  function openStock(symbol: string) {
    sessionStorage.setItem("nav-from-search", "1");
    sessionStorage.setItem("search-origin", pathname);
    closeSearch();
    window.dispatchEvent(new Event("stock-sheet-capture-page"));
    router.push(`/stock/${symbol}`);
  }

  function navigateTo(href: "/" | "/watchlist" | "/conversations" | "/profile") {
    const alreadyThere = pathname === href;

    if (settingsPhase !== "closed") {
      // Leaving Settings for Market/Watchlist always plays the swipe-right
      // close transition, then (only if actually changing page) navigates.
      setActivePill(href === "/" ? "market" : href === "/watchlist" ? "watchlist" : href === "/conversations" ? "conversations" : "profile");
      setSettingsPhase("closing");
      setTimeout(() => {
        setSettingsPhase("closed");
        if (!alreadyThere) router.push(href);
      }, SETTINGS_DURATION);
      return;
    }

    if (alreadyThere) return;
    setActivePill(href === "/" ? "market" : href === "/watchlist" ? "watchlist" : href === "/conversations" ? "conversations" : "profile");
    const exitClass = href === "/" ? "page-slide-right" : "page-slide-left";
    const main = document.querySelector("main");
    if (!main) { router.push(href); return; }
    main.classList.remove("page-slide-left", "page-slide-right", "page-enter-left", "page-enter-right");
    main.classList.add(exitClass);
    setTimeout(() => { router.push(href); setTimeout(() => main.classList.remove(exitClass), 100); }, SLIDE_DURATION - 20);
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

  const iconWrapClass = "phone-menu-icon relative z-10 flex h-full min-w-0 flex-1 items-center justify-center";
  return (
    <>
      {settingsPhase !== "closed" && <MobileSettingsPanel closing={settingsPhase === "closing"} onClose={closeSettings} origin={settingsOrigin} />}

      {/* Centered phone navigation bar. */}
      {searchOpen && <div className="fixed z-[1000] lg:hidden" style={{ top: visualViewport.top, left: visualViewport.left, width: visualViewport.width || "100vw", height: visualViewport.height || "100dvh", background: "transparent", backdropFilter: "blur(3px) brightness(0.97)", WebkitBackdropFilter: "blur(3px) brightness(0.97)" }} onClick={closeSearch} />}
      {searchOpen && (searchLoading || searchResults.length > 0 || searchQuery.trim()) && (
        <div className="smoked-glass-surface fixed z-[1001] max-h-[55vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl border border-white/25 lg:hidden" style={{ right: "1rem", bottom: `calc(${searchBottom} + 3.6rem + 0.75rem)`, display: "flex", flexDirection: "column-reverse", background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)" }}>
          {searchLoading && <p className="px-4 py-3 text-sm text-text-muted">Searching…</p>}
          {!searchLoading && searchQuery.trim() && !searchResults.length && <p className="px-4 py-3 text-sm text-text-muted">No results for “{searchQuery}”</p>}
          {!searchLoading && searchResults.map(result => (
            <button key={result.symbol} onClick={() => openStock(result.symbol)} className="flex w-full items-center gap-3 border-t border-border-subtle p-3 text-left">
              <StockLogo logo={searchLogos[result.symbol] && !SECTOR_ETFS.some(etf => etf.symbol === result.symbol) ? searchLogos[result.symbol] : undefined} size={48} sizeClassName="h-10 w-10 shrink-0" imageClassName="h-10 w-10 shrink-0 rounded-3xl border border-border-subtle bg-panel-muted object-contain" fallbackClassName="h-10 w-10 shrink-0 rounded-3xl object-contain" fallbackDisplay="flex" />
              <span className="min-w-0"><span className="block text-sm font-semibold text-text-primary">{result.symbol}</span><span className="block truncate text-xs text-text-muted">{result.name}</span></span>
            </button>
          ))}
        </div>
      )}
      <nav
        className="fixed inset-x-0 z-[60] flex lg:hidden items-center justify-center px-5 pointer-events-none"
        style={{ bottom: searchOpen ? searchBottom : 0, paddingBottom: searchOpen ? 0 : "calc(env(safe-area-inset-bottom) - 1rem)", paddingTop: searchOpen ? 0 : "1rem", zIndex: searchOpen ? 1002 : 60 }}
      >
        <div
          className="phone-menu-bar relative flex h-[3.6rem] w-full max-w-[34rem] flex-none items-center overflow-hidden pointer-events-auto"
          data-search-open={searchOpen}
          style={{
            height: BUBBLE_SIZE,
          }}
        >
          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/")}
            aria-label="Market"
          >
            <OptionalSvgIcon name="market" selected={activeIndex === 0} className={activeIndex === 0 ? "h-[29px] w-[29px]" : "h-6 w-6"} colorClassName="text-[var(--phone-menu-icon)]" />
          </button>

          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/watchlist")}
            aria-label="Watchlist"
          >
            <OptionalSvgIcon name="watchlist" selected={activeIndex === 1} className={activeIndex === 1 ? "h-[29px] w-[29px]" : "h-6 w-6"} colorClassName="text-[var(--phone-menu-icon)]" />
          </button>

          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/conversations")}
            aria-label="Conversations"
          >
            <OptionalSvgIcon name="conversations" selected={activeIndex === 2} className={activeIndex === 2 ? "h-[29px] w-[29px]" : "h-6 w-6"} colorClassName="text-[var(--phone-menu-icon)]" />
          </button>
          <button className={iconWrapClass} onClick={() => navigateTo("/profile")} aria-label="Profile">
            <OptionalSvgIcon name="profile" selected={activeIndex === 3} className={activeIndex === 3 ? "h-[29px] w-[29px]" : "h-6 w-6"} colorClassName="text-[var(--phone-menu-icon)]" />
          </button>
          <button className={iconWrapClass} onClick={openSettings} aria-label="Settings">
            <OptionalSvgIcon name="settings" selected={activeIndex === 4} className={activeIndex === 4 ? "h-[29px] w-[29px]" : "h-6 w-6"} colorClassName="text-[var(--phone-menu-icon)]" />
          </button>
          <div className="phone-menu-search-input absolute inset-0 z-20 flex items-center gap-2 px-2">
            <input ref={searchInputRef} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && searchResults[0]) openStock(searchResults[0].symbol); }} placeholder="Search stocks…" className="min-w-0 flex-1 bg-transparent px-3 text-base text-text-primary outline-none placeholder:text-text-muted" style={{ fontSize: 16, caretColor: "var(--color-accent)" }} />
            <button type="button" aria-label="Close search" onClick={closeSearch} className="phone-menu-close"><OptionalSvgIcon name="close" className="h-5 w-5" color="var(--phone-menu-close-icon)" /></button>
          </div>
        </div>
      </nav>

    </>
  );
}
