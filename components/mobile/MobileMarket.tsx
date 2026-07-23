"use client";

import { useEffect, useState } from "react";
import { MarketHome } from "@/components/market/MarketHome";
import { EarningsCalendarButton } from "@/components/mobile/EarningsCalendarButton";
import { StockAIChat } from "@/components/mobile/StockAIChat";

export function MobileMarket() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/market");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // quiet error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="pb-24">
      {/* Translucent top bar overlapping the safe area inset */}
      <div
        className="sticky top-0 z-30 px-4 pb-4 flex items-end justify-between gap-3 bg-background/40 backdrop-blur-xl border-b border-border-subtle/30"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive">
            Market Lens
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Market</h1>
        </div>
        <div className="flex items-center gap-2">
          <EarningsCalendarButton />
          <StockAIChat ticker="MARKET" />
        </div>
      </div>

      <div className="px-4 mt-4">
        <MarketHome data={data as Parameters<typeof MarketHome>[0]["data"]} loading={loading} />
      </div>
    </div>
  );
}