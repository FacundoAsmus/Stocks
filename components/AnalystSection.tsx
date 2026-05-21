import { TrendingDown, TrendingUp } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { AnalystRecommendation, PriceTarget } from "@/types/stock";

export function AnalystSection({
  recommendations,
  priceTarget,
  currentPrice
}: {
  recommendations: AnalystRecommendation[];
  priceTarget: PriceTarget;
  currentPrice: number;
}) {
  const latest = recommendations[0];
  const analystCount = latest
    ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
    : 0;
  const upside = priceTarget.targetMean && currentPrice
    ? ((priceTarget.targetMean - currentPrice) / currentPrice) * 100
    : null;
  const isUpside = (upside ?? 0) >= 0;

  const breakdown = latest
    ? [
        ["Strong Buy", latest.strongBuy, "bg-positive"],
        ["Buy", latest.buy, "bg-positive/80"],
        ["Hold", latest.hold, "bg-accent"],
        ["Sell", latest.sell, "bg-negative/80"],
        ["Strong Sell", latest.strongSell, "bg-negative"]
      ] as const
    : [];

  return (
    <section className="rounded-md border border-border-subtle bg-panel p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Analysts</p>
          <h2 className="mt-2 text-2xl font-semibold text-text-primary">Recommendations</h2>
        </div>
        {priceTarget.lastUpdated ? (
          <p className="text-sm text-text-muted">Updated {priceTarget.lastUpdated}</p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-md bg-panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Avg. Price Target</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {formatCurrency(priceTarget.targetMean)}
          </p>
        </div>
        <div className="rounded-md bg-panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Upside / Downside</p>
          <p className={isUpside ? "mt-2 flex items-center gap-2 text-2xl font-semibold text-positive" : "mt-2 flex items-center gap-2 text-2xl font-semibold text-negative"}>
            {isUpside ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {upside === null ? "N/A" : formatPercent(upside)}
          </p>
        </div>
        <div className="rounded-md bg-panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Analyst Count</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{analystCount || "N/A"}</p>
        </div>
      </div>

      {latest ? (
        <div className="mt-6 space-y-4">
          {breakdown.map(([label, count, colorClass]) => {
            const width = analystCount ? Math.max((count / analystCount) * 100, count ? 4 : 0) : 0;

            return (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-medium text-text-primary">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-text-muted">
          Finnhub does not currently provide analyst recommendations for this symbol.
        </p>
      )}
    </section>
  );
}
