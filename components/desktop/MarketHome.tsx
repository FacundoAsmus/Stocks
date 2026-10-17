"use client";

import { MarketHeatmap } from "@/components/market/MarketHeatmap";

// The desktop market page intentionally does not render a scrolling ticker.
export function MarketHome() {
  return (
    <main className="overflow-hidden bg-black" style={{ height: "calc((100dvh - var(--header-height, 0px)) * 1.3)" }}>
      <MarketHeatmap desktopLayout />
    </main>
  );
}
