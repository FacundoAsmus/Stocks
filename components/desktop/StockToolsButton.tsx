"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MA_OPTIONS = [7, 25, 99] as const;

type MAStateDetail = { symbol: string; active: number[]; available: number[] };
type LineModeDetail = { symbol: string; active: boolean };

export function StockToolsButton({ symbol, chartHeight = 384 }: { symbol: string; chartHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [activeMAs, setActiveMAs] = useState<number[]>([]);
  const [availableMAs, setAvailableMAs] = useState<number[]>([]);
  const [lineModeActive, setLineModeActive] = useState(false);

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
      if (detail?.symbol === symbol) setLineModeActive(detail.active);
    }
    window.addEventListener("watchlist-stock-line-state", syncLineMode);
    const refreshTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("watchlist-stock-ma-request", { detail: { symbol } }));
    }, 0);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener("watchlist-stock-ma-state", syncMAState);
      window.removeEventListener("watchlist-stock-line-state", syncLineMode);
    };
  }, [symbol]);

  function toggleMA(maWindow: number) {
    window.dispatchEvent(new CustomEvent("watchlist-stock-ma-toggle", { detail: { symbol, window: maWindow } }));
  }

  function toggleLineMode() {
    const nextActive = !lineModeActive;
    setLineModeActive(nextActive);
    window.dispatchEvent(new CustomEvent("watchlist-stock-line-mode", { detail: { symbol, active: nextActive } }));
  }

  const expandedHeight = chartHeight + 72;

  return (
    <div className="relative h-10 w-10 shrink-0">
      <div
        className={cn(
          "desktop-alert-glass smoked-glass-surface absolute right-0 top-0 z-40 overflow-hidden rounded-3xl border border-white/15 text-text-primary",
          "w-10"
        )}
        style={{
          height: open ? expandedHeight : 40,
          transition: "height 0.32s cubic-bezier(0.2,0,0,1)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close stock tools" : "Open stock tools"}
          aria-expanded={open}
          className="flex h-10 w-full shrink-0 items-center justify-center"
          title="Stock tools"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tools-icon.svg" alt="" className="stock-tools-icon h-6 w-6 object-contain" />
        </button>
        <div className={cn("flex flex-col items-center gap-2 pt-2 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")}>
          {MA_OPTIONS.map((window) => {
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
                  "flex h-9 w-full items-center justify-center rounded-xl border text-[6px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                  active ? "bg-white/10" : "bg-black/10 hover:bg-white/10"
                )}
                style={{ borderColor: active ? "#ADFA1B" : "rgba(255,255,255,0.14)", color: active ? "#ADFA1B" : undefined }}
              >
                <span style={{ fontSize: "50%" }}>MA({window})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleLineMode}
            aria-pressed={lineModeActive}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-xl border transition-colors",
              lineModeActive ? "border-[#ADFA1B] bg-white/10 text-[#ADFA1B]" : "border-white/15 bg-black/10 hover:bg-white/10"
            )}
            aria-label={lineModeActive ? "Cancel line placement" : "Place a horizontal price line"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/line-graph-simple-icon.svg" alt="" className="stock-tools-icon h-4 w-4 object-contain" />
          </button>
        </div>
      </div>
    </div>
  );
}
