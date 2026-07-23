"use client";

import Link from "next/link";
import { List, Settings, Moon, Sun, Monitor, ChevronLeft, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark ? "#000000" : "#ffffff");
}

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

// Desktop settings dropdown
function DesktopSettingsPanel({ onClose }: { onClose: () => void }) {
  const [theme, setTheme]     = useState<Theme>(getStoredTheme);
  const [proMode, setProMode] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("pro-mode") === "1" : false
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  function toggleProMode() {
    const next = !proMode;
    setProMode(next);
    localStorage.setItem("pro-mode", next ? "1" : "0");
    window.dispatchEvent(new Event("pro-mode-changed"));
  }

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "dark",   label: "Dark",   icon: <Moon className="h-4 w-4" /> },
    { value: "light",  label: "Light",  icon: <Sun  className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-border-subtle bg-panel shadow-2xl z-50 overflow-hidden"
      style={{ animation: "dropIn 0.15s ease both" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <span className="text-sm font-semibold text-text-primary">Settings</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Appearance */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-2">Appearance</p>
        <div className="flex gap-2">
          {themeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => changeTheme(opt.value)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 rounded-lg p-2.5 border text-xs font-medium transition-all",
                theme === opt.value
                  ? "bg-positive/10 border-positive text-positive"
                  : "border-border-subtle text-text-muted hover:border-positive/40"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pro Mode */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-2">Pro Mode</p>
        <button
          onClick={toggleProMode}
          className="w-full flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2.5"
        >
          <span className="flex flex-col gap-0.5 text-left">
            <span className="text-sm text-text-primary font-medium">Horizontal crosshair</span>
            <span className="text-xs text-text-muted">Adds horizontal line at hovered price level</span>
          </span>
          <span className="shrink-0 h-6 w-11 rounded-full border-2 transition-colors relative"
            style={{ borderColor: proMode ? "var(--color-positive)" : "var(--color-border-subtle)",
                     backgroundColor: proMode ? "var(--color-positive)" : "var(--color-panel-muted)" }}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: proMode ? "calc(100% - 1.125rem)" : "0.125rem" }} />
          </span>
        </button>
      </div>

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const navItems = [
  { href: "/", label: "Market", icon: "globe" as const },
  { href: "/watchlist", label: "Watchlist", icon: "list" as const },
] as const;

export function AppNav() {
  const pathname     = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Apply stored theme on mount (desktop)
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return (
    <nav className="flex items-center gap-4 relative">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-2 text-base font-semibold text-text-primary transition-all duration-200 hover:-translate-y-1 hover:scale-[1.04]"
          >
            <span className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-200",
              isActive
                ? "border-positive bg-positive text-black"
                : "border-positive/30 bg-positive/10 text-positive group-hover:border-positive/60"
            )}>
              {item.icon === "globe"
                ? <GlobeIcon className="h-5 w-5" />
                : <List className="h-5 w-5" aria-hidden />
              }
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Settings button */}
      <div className="relative">
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className={cn(
            "group flex items-center gap-2 text-base font-semibold text-text-primary transition-all duration-200 hover:-translate-y-1 hover:scale-[1.04]"
          )}
        >
          <span className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-200",
            settingsOpen
              ? "border-positive bg-positive text-black"
              : "border-positive/30 bg-positive/10 text-positive group-hover:border-positive/60"
          )}>
            <Settings className="h-5 w-5" />
          </span>
          <span>Settings</span>
        </button>
        {settingsOpen && <DesktopSettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>
    </nav>
  );
}
