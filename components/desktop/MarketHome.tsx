"use client";

import { MarketHeatmap } from "@/components/market/MarketHeatmap";

// The desktop market page intentionally does not render a scrolling ticker.
export function MarketHome() {
  return (
    <main className="h-[calc(100dvh-var(--header-height,0px))] overflow-hidden bg-black">
      <MarketHeatmap desktopLayout />
    </main>
  );
}
