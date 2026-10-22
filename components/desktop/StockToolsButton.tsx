"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import { StockPriceAlertButton } from "@/components/StockPriceAlertButton";

const MA_OPTIONS = [
  { window: 7, color: "#f59e0b", iconName: "tools-ma-7" },
  { window: 25, color: "#ec4899", iconName: "tools-ma-25" },
  { window: 99, color: "#8b5cf6", iconName: "tools-ma-99" },
] as const;

type MAStateDetail = { symbol: string; active: number[]; available: number[] };
type ChartToolsRequest = { symbol: string; clientX: number; clientY: number };

export function StockFunctionButton({ symbol, name, currentPrice, chartHeight = 384 }: {
  symbol: string;
  name: string;
  currentPrice: number;
  chartHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const [activeMAs, setActiveMAs] = useState<number[]>([]);
  const [availableMAs, setAvailableMAs] = useState<number[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    function syncMAState(event: Event) {
      const detail = (event as CustomEvent<MAStateDetail>).detail;
      if (!detail || detail.symbol !== symbol) return;
      setActiveMAs(detail.active);
      setAvailableMAs(detail.available);
    }
    window.addEventListener("watchlist-stock-ma-state", syncMAState);
    const refreshTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("watchlist-stock-ma-request", { detail: { symbol } }));
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener("watchlist-stock-ma-state", syncMAState);
    };
  }, [symbol]);

  function startCompareSearch() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("watchlist-compare-search-start", { detail: symbol }));
  }

  const expandedHeight = chartHeight + 32;
  return (
    <div className="relative h-10 w-10 shrink-0 transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.12]">
      <div
        ref={panelRef}
        className={cn("desktop-alert-glass desktop-stock-tools-panel smoked-glass-surface absolute right-0 top-0 z-40 w-10 overflow-hidden border text-text-primary", open && "is-open")}
        style={{ height: open ? expandedHeight : 40, borderRadius: open ? 24 : "50%", transition: "height 0.32s cubic-bezier(0.2,0,0,1), border-radius 0.32s cubic-bezier(0.2,0,0,1)" }}
        onMouseLeave={() => { if (open) setOpen(false); }}
      >
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close functions" : "Open functions"} aria-expanded={open}
          className="flex h-10 w-10 shrink-0 items-center justify-center" title="Functions">
          <OptionalSvgIcon name="tools" className="stock-tools-icon h-6 w-6" />
        </button>
        <div className={cn("flex flex-col items-center gap-2 pt-2 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")}>
          <button type="button" onClick={startCompareSearch} className="flex h-9 w-full items-center justify-center bg-transparent opacity-35 transition-opacity hover:opacity-100"
            aria-label={`Compare ${symbol} with another stock`} title="Compare stock">
            <OptionalSvgIcon name="compare" className="h-5 w-5" color="#f97316" />
          </button>
          {MA_OPTIONS.map(({ window: maWindow, color, iconName }) => {
            const active = activeMAs.includes(maWindow);
            const available = availableMAs.includes(maWindow);
            return <button key={maWindow} type="button" disabled={!available}
              onClick={() => { window.dispatchEvent(new CustomEvent("watchlist-stock-ma-toggle", { detail: { symbol, window: maWindow } })); setOpen(false); }}
              aria-pressed={active}
              className={cn("flex h-9 w-full items-center justify-center bg-transparent transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20", active ? "opacity-100" : "opacity-35")}
              style={{ color, fontSize: "50%" }}>
              <OptionalSvgIcon name={iconName} className="h-5 w-7" color={color} />
            </button>;
          })}
          <div className="flex h-10 w-full items-center justify-center">
            <StockPriceAlertButton symbol={symbol} name={name} currentPrice={currentPrice} />
          </div>
        </div>
      </div>
    </div>
  );
}

type DrawingAction = "line" | "rectangle" | "diagonal" | "erase";

/** Context menu opened by right-clicking the stock chart. It has no trigger of its own. */
export function StockChartToolsMenu({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ left: 0, bottom: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const menuHeight = 4 * 36 + 3 * 8 + 20;

  useEffect(() => {
    function onChartContextMenu(event: Event) {
      const detail = (event as CustomEvent<ChartToolsRequest>).detail;
      if (!detail || detail.symbol !== symbol) return;
      setPosition({
        left: Math.max(8, Math.min(detail.clientX + 12, window.innerWidth - 48)),
        bottom: Math.max(8, Math.min(window.innerHeight - detail.clientY + 12, window.innerHeight - 8)),
      });
      setOpen(true);
      setExpanded(false);
      window.requestAnimationFrame(() => setExpanded(true));
    }
    window.addEventListener("watchlist-stock-chart-context-menu", onChartContextMenu);
    return () => window.removeEventListener("watchlist-stock-chart-context-menu", onChartContextMenu);
  }, [menuHeight, symbol]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => setExpanded(true));
    function closeOutside(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(action: DrawingAction) {
    setOpen(false);
    if (action === "erase") {
      window.dispatchEvent(new CustomEvent("watchlist-stock-lines-clear", { detail: { symbol } }));
      return;
    }
    const modeEvent = action === "line"
      ? "watchlist-stock-line-mode"
      : action === "rectangle"
        ? "watchlist-stock-square-mode"
        : "watchlist-stock-diagonal-mode";
    window.dispatchEvent(new CustomEvent(modeEvent, { detail: { symbol, active: true } }));
  }

  if (!open) return null;
  const actions: Array<{ action: DrawingAction; label: string; icon: string; color?: string }> = [
    { action: "line", label: "Draw price line", icon: "tools-line" },
    { action: "diagonal", label: "Draw diagonal line", icon: "tools-diagonal" },
    { action: "rectangle", label: "Draw rectangle", icon: "tools-rectangle" },
    { action: "erase", label: "Erase drawings", icon: "tools-erase", color: "#ff3003" },
  ];
  return (
    <div ref={panelRef} role="toolbar" aria-label="Chart drawing tools"
      className="desktop-alert-glass desktop-stock-tools-panel smoked-glass-surface fixed z-[1200] overflow-hidden border text-text-primary"
      style={{ left: position.left, bottom: position.bottom, width: expanded ? 40 : 0, height: expanded ? menuHeight : 0, borderRadius: expanded ? 24 : 0, opacity: expanded ? 1 : 0, pointerEvents: expanded ? "auto" : "none", transition: "width 0.32s cubic-bezier(0.2,0,0,1), height 0.32s cubic-bezier(0.2,0,0,1), border-radius 0.32s cubic-bezier(0.2,0,0,1), opacity 0.18s ease" }}>
      <div className="flex flex-col items-center gap-2 px-0.5 pt-2">
        {actions.map(({ action, label, icon, color }) => <button key={action} type="button" aria-label={label} title={label}
          onClick={() => choose(action)} className="flex h-9 w-full items-center justify-center bg-transparent opacity-45 transition-opacity hover:opacity-100">
          <OptionalSvgIcon name={icon} className="h-5 w-5" color={color} />
        </button>)}
      </div>
    </div>
  );
}
