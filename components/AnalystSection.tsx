import type { AnalystRecommendation, PriceTarget } from "@/types/stock";

export function AnalystSection({
  recommendations,
  priceTarget
}: {
  recommendations: AnalystRecommendation[];
  priceTarget: PriceTarget;
  currentPrice: number;
}) {
  const latest = recommendations[0];
  const analystCount = latest
    ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
    : 0;

  const breakdown = latest
    ? [
        ["Strong Buy", latest.strongBuy, "bg-emerald-400"],
        ["Buy",        latest.buy,       "bg-lime-400"],
        ["Hold",       latest.hold,      "bg-yellow-400"],
        ["Sell",       latest.sell,      "bg-orange-500"],
        ["Strong Sell",latest.strongSell,"bg-red-600"]
      ] as const
    : [];

  return (
    <section className="rounded-md border border-[#3a3a42] bg-black p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Analysts</p>
          <h2 className="mt-2 text-2xl font-semibold text-text-primary">Recommendations</h2>
        </div>
        {priceTarget.lastUpdated ? (
          <p className="text-sm text-text-muted">Updated {priceTarget.lastUpdated}</p>
        ) : null}
      </div>

      {latest ? (
        <div className="mt-5 relative">
          {/* Analyst count floated top-left over the chart */}
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-text-primary">{analystCount}</span>
            <span className="text-sm text-text-muted">analysts covering this stock</span>
          </div>

          <div className="space-y-4">
            {breakdown.map(([label, count, colorClass]) => {
              const width = analystCount ? Math.max((count / analystCount) * 100, count ? 4 : 0) : 0;

              return (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-text-muted">{label}</span>
                    <span className="font-medium text-text-primary">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-muted">
                    <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-text-muted">
          Finnhub does not currently provide analyst recommendations for this symbol.
        </p>
      )}
    </section>
  );
}
