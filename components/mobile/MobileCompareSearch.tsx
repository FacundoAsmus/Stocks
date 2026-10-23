"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { StockLogo } from "@/components/StockLogo";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import { SECTOR_ETFS } from "@/components/market/EtfList";

type SearchResult = { symbol: string; name: string };

export function MobileCompareSearch({
  primarySymbol,
  open,
  onOpenChange,
  onSelect,
}: {
  primarySymbol: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (symbol: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [viewport, setViewport] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setMounted(true), []);

  // Leave the AI pill visible while compare mode is idle. When activated,
  // show the orange pill at the same position for a frame, then expand it
  // with the exact width/easing used by the phone AI input.
  useEffect(() => {
    if (open) {
      setVisible(true);
      setExpanded(false);
      const frame = window.requestAnimationFrame(() => setExpanded(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setExpanded(false);
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 320);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  useEffect(() => {
    const updateViewport = () => {
      const visual = window.visualViewport;
      setViewport(visual
        ? { top: visual.offsetTop, left: visual.offsetLeft, width: visual.width, height: visual.height }
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
  }, []);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 340);
    return () => {
      window.clearTimeout(timer);
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLogos({});
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json() as { results?: Array<{ symbol: string; description: string }> };
        const nextResults = (payload.results ?? []).slice(0, 8)
          .map(({ symbol, description }) => ({ symbol, name: description }))
          .filter((result) => result.symbol.toUpperCase() !== primarySymbol.toUpperCase());
        if (controller.signal.aborted) return;
        setResults(nextResults);
        setLogos({});
        if (nextResults.length) {
          try {
            const symbols = nextResults.map((result) => result.symbol).join(",");
            const logoResponse = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal });
            const logoPayload = await logoResponse.json() as { stocks?: Array<{ symbol: string; logo?: string }> };
            const nextLogos: Record<string, string> = {};
            for (const item of logoPayload.stocks ?? []) if (item.logo) nextLogos[item.symbol] = item.logo;
            if (!controller.signal.aborted) setLogos(nextLogos);
          } catch { /* Logo lookup is optional; keep search results. */ }
        }
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [primarySymbol, query]);

  function close() {
    onOpenChange(false);
    setQuery("");
    setResults([]);
    setLogos({});
  }

  function choose(symbol: string) {
    close();
    onSelect(symbol);
  }

  if (!mounted || !visible) return null;
  const viewportWidth = viewport.width || window.innerWidth;
  const viewportHeight = viewport.height || window.innerHeight;
  const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - viewport.top);
  const bottom = open && keyboardInset > 8 ? `${keyboardInset + 12}px` : "calc(env(safe-area-inset-bottom) - 0.5rem)";
  const showResults = open && (loading || results.length > 0 || query.trim().length > 0);

  return createPortal(
    <>
      <div
        className="lg:hidden"
        style={{
          position: "fixed", top: viewport.top, left: viewport.left, width: viewportWidth, height: viewportHeight,
          zIndex: 1000, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.28s ease",
        }}
        onClick={close}
      >
        <div style={{ position: "absolute", inset: 0, backdropFilter: open ? "blur(3px) brightness(0.97)" : "none", WebkitBackdropFilter: open ? "blur(3px) brightness(0.97)" : "none", transition: "backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease" }} />
      </div>

      {showResults && <div
        className="smoked-glass-surface fixed lg:hidden overflow-y-auto rounded-2xl border border-orange-400/35"
        style={{
          zIndex: 1003, right: "1rem", width: "calc(100vw - 2rem)", bottom: `calc(${bottom} + 3.5rem + 0.75rem)`, maxHeight: "55vh",
          display: "flex", flexDirection: "column-reverse", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.22s ease, transform 0.22s ease",
          background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))",
          backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 0 14px rgba(249,115,22,0.32), 0 0 5px rgba(249,115,22,0.5), 0 24px 70px rgba(0,0,0,0.28), inset 0 0 18px rgba(0,0,0,0.18)",
        }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        {loading && <p style={{ padding: "16px 18px", fontSize: 13, color: "var(--color-text-muted)" }}>Searching…</p>}
        {!loading && query.trim() && !results.length && <p style={{ padding: "16px 18px", fontSize: 13, color: "var(--color-text-muted)" }}>No other stocks found.</p>}
        {!loading && results.map((result) => {
          const hasLogo = Boolean(logos[result.symbol]) && !SECTOR_ETFS.some((etf) => etf.symbol === result.symbol);
          return <button key={result.symbol} type="button" onClick={() => choose(result.symbol)}
            className="flex w-full items-center gap-3 border-t border-border-subtle px-4 py-3 text-left first:border-t-0">
            <StockLogo logo={hasLogo ? logos[result.symbol] : undefined} symbol={result.symbol} size={48}
              sizeClassName="h-10 w-10 shrink-0"
              imageClassName="h-10 w-10 shrink-0 rounded-3xl border border-border-subtle bg-panel-muted object-contain"
              fallbackClassName="h-10 w-10 shrink-0 rounded-3xl object-contain" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary">{result.symbol}</span>
              <span className="block truncate text-xs text-text-muted">{result.name}</span>
            </span>
          </button>;
        })}
      </div>}

      <div className="smoked-glass-surface fixed lg:hidden overflow-hidden rounded-full border border-orange-400/35 text-[#f97316]"
        style={{
          zIndex: 1004, bottom, right: expanded ? "1rem" : "1.25rem", width: expanded ? "calc(100vw - 2rem)" : "3.5rem", height: "3.5rem",
          background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))",
          backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: expanded ? "0 0 14px rgba(249,115,22,0.42), 0 0 5px rgba(249,115,22,0.65), 0 24px 60px rgba(0,0,0,0.24), inset 0 0 16px rgba(0,0,0,0.18)" : "0 24px 60px rgba(0,0,0,0.24), inset 0 0 16px rgba(0,0,0,0.18)",
          transition: "width 0.32s cubic-bezier(0.2,0,0,1), right 0.32s cubic-bezier(0.2,0,0,1), bottom 0.2s ease, box-shadow 0.22s ease",
        }}>
        <button type="button" aria-label="Compare stocks" onClick={() => onOpenChange(true)}
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: expanded ? 0 : 1, pointerEvents: expanded ? "none" : "auto", transition: "opacity 0.16s ease" }}>
          <OptionalSvgIcon name="compare" className="h-7 w-7" color="#f97316" />
        </button>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", opacity: expanded ? 1 : 0, pointerEvents: expanded ? "auto" : "none", transition: "opacity 0.22s ease", transitionDelay: expanded ? "0.14s" : "0s" }}>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") close(); }}
            placeholder={`Compare ${primarySymbol} with`} aria-label={`Compare ${primarySymbol} with another stock`}
            className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#ff9f2e]" style={{ caretColor: "#f97316" }} />
          <button type="button" aria-label="Close comparison search" onClick={close} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <OptionalSvgIcon name="close" className="h-4 w-4" colorClassName="text-on-accent" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
