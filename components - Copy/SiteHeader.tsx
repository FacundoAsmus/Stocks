"use client";

import { useEffect, useRef } from "react";

import { AppNav } from "@/components/AppNav";
import { SearchBar } from "@/components/SearchBar";

export function SiteHeader() {
  const headerRef = useRef<HTMLElement>(null);

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
      className="sticky top-0 z-40 border-b border-border-subtle/70 bg-background/86 backdrop-blur-xl hidden lg:block"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <AppNav />
        <SearchBar />
      </div>
    </header>
  );
}
