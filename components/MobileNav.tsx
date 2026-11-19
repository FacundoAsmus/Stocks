"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
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
  const [activePill,   setActivePill]   = useState<"market" | "watchlist">(
    pathname === "/watchlist" ? "watchlist" : "market"
  );

  useEffect(() => {
    setActivePill(pathname === "/watchlist" ? "watchlist" : "market");
  }, [pathname]);

  // Apply stored theme on mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const showNav = pathname === "/" || pathname === "/watchlist";
  if (!showNav) return null;

  const isWatchlist = activePill === "watchlist";
  const activeIndex = settingsPhase !== "closed" ? 2 : (isWatchlist ? 1 : 0);
  const BUBBLE_SIZE = "3rem";

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
  return (
    <>
      {settingsPhase !== "closed" && <MobileSettingsPanel closing={settingsPhase === "closing"} onClose={closeSettings} origin={settingsOrigin} />}

      {/* Centered phone navigation bar. */}
      <nav
        className="fixed bottom-0 inset-x-0 z-[60] flex lg:hidden items-center justify-center px-5 pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) - 1rem)", paddingTop: "1rem" }}
      >
        <div
          className="phone-menu-bar relative flex h-12 w-full max-w-[34rem] flex-none items-center rounded-[14px] overflow-hidden pointer-events-auto"
          style={{
            height: BUBBLE_SIZE,
          }}
        >
          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/")}
            aria-label="Market"
          >
            <OptionalSvgIcon name="market" selected={activeIndex === 0} className="h-6 w-6" colorClassName={activeIndex === 0 ? "text-accent" : "text-text-muted"} />
          </button>

          <button
            className={iconWrapClass}
            onClick={() => navigateTo("/watchlist")}
            aria-label="Watchlist"
          >
            <OptionalSvgIcon name="watchlist" selected={activeIndex === 1} className="h-6 w-6" colorClassName={activeIndex === 1 ? "text-accent" : "text-text-muted"} />
          </button>

          <button
            className={iconWrapClass}
            onClick={openSettings}
            aria-label="Settings"
          >
            <OptionalSvgIcon name="settings" selected={activeIndex === 2} className="h-6 w-6" colorClassName={activeIndex === 2 ? "text-accent" : "text-text-muted"} />
          </button>
        </div>
      </nav>

    </>
  );
}
