"use client";

import { MarketHeatmap } from "@/components/market/MarketHeatmap";

// The same responsive heat-map experience is used on phones and desktop.
// It includes the full group picker, heat transition, company tiles, and
// sector-fund link instead of maintaining a reduced mobile-only market view.
export function MobileMarket() {
  return <MarketHeatmap />;
}
