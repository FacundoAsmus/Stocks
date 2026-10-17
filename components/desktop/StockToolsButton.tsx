"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MA_OPTIONS = [
  { window: 7, color: "#f59e0b" },
  { window: 25, color: "#ec4899" },
  { window: 99, color: "#8b5cf6" },
] as const;

type MAStateDetail = { symbol: string; active: number[]; available: number[] };

export function StockToolsButton({ symbol, chartHeight = 384 }: { symbol: string; chartHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [activeMAs, setActiveMAs] = useState<number[]>([]);
  const [availableMAs, setAvailableMAs] = useState<number[]>([]);

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

  function toggleMA(maWindow: number) {
    window.dispatchEvent(new CustomEvent("watchlist-stock-ma-toggle", { detail: { symbol, window: maWindow } }));
  }

  const expandedHeight = chartHeight + 72;

  return (
    <div className="relative h-10 w-10 shrink-0">
      <div
        className={cn(
          "desktop-alert-glass smoked-glass-surface absolute right-0 top-0 z-40 overflow-hidden rounded-3xl border border-white/15 text-text-primary",
          open ? "w-28" : "w-10"
        )}
        style={{
          height: open ? expandedHeight : 40,
          transition: "width 0.32s cubic-bezier(0.2,0,0,1), height 0.32s cubic-bezier(0.2,0,0,1)",
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
        <div className={cn("flex flex-col gap-2 px-2 pt-2 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")}>
          {MA_OPTIONS.map(({ window, color }) => {
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
                  "flex h-9 w-full items-center justify-between gap-1 rounded-xl border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                  active ? "bg-white/10" : "bg-black/10 hover:bg-white/10"
                )}
                style={{ borderColor: active ? color : "rgba(255,255,255,0.14)", color: active ? color : undefined }}
              >
                <span>MA({window})</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
