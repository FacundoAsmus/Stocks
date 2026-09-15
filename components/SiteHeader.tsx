"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import { SearchBar } from "@/components/SearchBar";

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  // Market and Watchlist intentionally share the same desktop control bar.
  const usesUnifiedToolbar = pathname === "/" || pathname === "/watchlist";

  // Publish the header's real rendered height as a CSS var so anything
  // sticky below it (e.g. the market ticker bar) can pin flush underneath
  // it instead of relying on a hardcoded pixel guess that drifts out of
  // sync and leaves a gap.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => document.documentElement.style.setProperty("--header-height", `${el.offsetHeight}px`);
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-40 hidden lg:block ${usesUnifiedToolbar ? "watchlist-toolbar border-b border-transparent bg-background/50 backdrop-blur-xl" : "border-b border-border-subtle/70 bg-background/86 backdrop-blur-xl"}`}
    >
      <div className={`flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between ${usesUnifiedToolbar ? "lg:px-4" : "mx-auto max-w-7xl lg:px-8"}`}>
        <AppNav variant={usesUnifiedToolbar ? "links" : "full"} />
        {usesUnifiedToolbar ? (
          <div className="flex w-full items-center gap-3 lg:w-auto lg:min-w-[34rem]">
            <SearchBar />
            <AppNav variant="settings" />
          </div>
        ) : <SearchBar />}
      </div>
    </header>
  );
}
