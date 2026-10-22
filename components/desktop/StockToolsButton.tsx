"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

const MA_OPTIONS = [
  { window: 7, color: "#f59e0b", iconName: "tools-ma-7" },
  { window: 25, color: "#ec4899", iconName: "tools-ma-25" },
  { window: 99, color: "#8b5cf6", iconName: "tools-ma-99" },
] as const;

type MAStateDetail = { symbol: string; active: number[]; available: number[] };
type LineModeDetail = { symbol: string; active: boolean };
type SquareModeDetail = { symbol: string; active: boolean };

export function StockToolsButton({ symbol, chartHeight = 384 }: { symbol: string; chartHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [activeMAs, setActiveMAs] = useState<number[]>([]);
  const [availableMAs, setAvailableMAs] = useState<number[]>([]);
  const [lineModeActive, setLineModeActive] = useState(false);
  const [squareModeActive, setSquareModeActive] = useState(false);
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
    function syncLineMode(event: Event) {
      const detail = (event as CustomEvent<LineModeDetail>).detail;
      if (detail?.symbol === symbol) {
        setLineModeActive(detail.active);
        if (!detail.active) setOpen(false);
      }
    }
    window.addEventListener("watchlist-stock-line-state", syncLineMode);
    function syncSquareMode(event: Event) {
      const detail = (event as CustomEvent<SquareModeDetail>).detail;
      if (detail?.symbol === symbol) setSquareModeActive(detail.active);
    }
    window.addEventListener("watchlist-stock-square-state", syncSquareMode);
    const refreshTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("watchlist-stock-ma-request", { detail: { symbol } }));
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener("watchlist-stock-ma-state", syncMAState);
      window.removeEventListener("watchlist-stock-line-state", syncLineMode);
      window.removeEventListener("watchlist-stock-square-state", syncSquareMode);
    };
  }, [symbol]);

  function toggleMA(maWindow: number) {
    window.dispatchEvent(new CustomEvent("watchlist-stock-ma-toggle", { detail: { symbol, window: maWindow } }));
    setOpen(false);
  }

  function toggleLineMode() {
    const nextActive = !lineModeActive;
    setLineModeActive(nextActive);
    setSquareModeActive(false);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("watchlist-stock-line-mode", { detail: { symbol, active: nextActive } }));
  }

  function clearLines() {
    setOpen(false);
    setLineModeActive(false);
    setSquareModeActive(false);
    window.dispatchEvent(new CustomEvent("watchlist-stock-lines-clear", { detail: { symbol } }));
  }

  function toggleSquareMode() {
    const nextActive = !squareModeActive;
    setSquareModeActive(nextActive);
    setLineModeActive(false);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("watchlist-stock-square-mode", { detail: { symbol, active: nextActive } }));
  }

  const expandedHeight = chartHeight + 32;

  return (
    <div className="relative h-10 w-10 shrink-0 transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.12]">
      <div
        ref={panelRef}
        className={cn(
          "desktop-alert-glass desktop-stock-tools-panel smoked-glass-surface absolute right-0 top-0 z-40 overflow-hidden border text-text-primary",
          "w-10",
          open && "is-open"
        )}
        style={{
          height: open ? expandedHeight : 40,
          borderRadius: open ? 24 : "50%",
          transition: "height 0.32s cubic-bezier(0.2,0,0,1), border-radius 0.32s cubic-bezier(0.2,0,0,1)",
        }}
        onMouseLeave={() => { if (open) setOpen(false); }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close stock tools" : "Open stock tools"}
          aria-expanded={open}
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          title="Stock tools"
        >
          <OptionalSvgIcon name="tools" className="stock-tools-icon h-6 w-6" />
        </button>
        <div className={cn("flex flex-col items-center gap-2 pt-2 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")}>
          {MA_OPTIONS.map(({ window, color, iconName }) => {
            const active = activeMAs.includes(window);
            const available = availableMAs.includes(window);
            return (
              <button
                key={window}
                type="button"
                disabled={!available}
                onClick={() => toggleMA(window)}
                aria-pressed={active}
                className={cn(
                  "flex h-9 w-full items-center justify-center bg-transparent transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20",
                  active ? "opacity-100" : "opacity-35"
                )}
                style={{ color, fontSize: "50%" }}
              >
                <OptionalSvgIcon name={iconName} className="h-5 w-7" color={color} />
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleLineMode}
            aria-pressed={lineModeActive}
            className={cn(
              "flex h-9 w-full items-center justify-center bg-transparent transition-opacity hover:opacity-100",
              lineModeActive ? "opacity-100" : "opacity-35"
            )}
            aria-label={lineModeActive ? "Cancel line placement" : "Place a horizontal price line"}
          >
            <OptionalSvgIcon name="tools-line" className="stock-tools-icon h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleSquareMode}
            aria-pressed={squareModeActive}
            className={cn(
              "flex h-9 w-full items-center justify-center bg-transparent transition-opacity hover:opacity-100",
              squareModeActive ? "opacity-100" : "opacity-35"
            )}
            aria-label={squareModeActive ? "Cancel square placement" : "Draw a square on the stock chart"}
            title="Draw square"
          >
            <OptionalSvgIcon name="tools-square" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={clearLines}
            className="flex h-9 w-full items-center justify-center bg-transparent opacity-35 transition-opacity hover:opacity-100"
            aria-label="Erase all drawn chart lines and squares"
            title="Erase drawings"
          >
            <OptionalSvgIcon name="tools-erase" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
