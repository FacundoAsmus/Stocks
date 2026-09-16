"use client";

import { MarketHeatmap } from "@/components/market/MarketHeatmap";

// The desktop market page intentionally does not render a scrolling ticker.
export function MarketHome() {
  return (
    <main className="min-h-dvh bg-black">
      <MarketHeatmap />
    </main>
  );
}
