import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { WheelPrice } from "@/components/PriceChart";
import { expectedRevenueGrowthPct, getNextReport } from "@/lib/earnings";
import type { EarningsEvent } from "@/types/stock";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

type MetricValue = number | string | null;

type FundamentalItem = {
  label: string;
  value: string;
  tone: "positive" | "neutral" | "negative";
  note: string;
};

function toNumber(value: MetricValue | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function ratioTone(value: number | null, low: number, high: number, lowerIsBetter = true) {
  if (value === null) return { tone: "neutral" as const, note: "Data unavailable" };

  if (lowerIsBetter) {
    if (value <= low) return { tone: "positive" as const, note: "Below Average" };
    if (value >= high) return { tone: "negative" as const, note: "Above Average" };
  } else {
    if (value >= high) return { tone: "positive" as const, note: "Above Average" };
    if (value <= low) return { tone: "negative" as const, note: "Below Average" };
  }

  return { tone: "neutral" as const, note: "In Range" };
}

function dividendTone(value: number | null) {
  if (value === null) return { tone: "neutral" as const, note: "Data unavailable" };
  if (value >= 3) return { tone: "positive" as const, note: "Above Average" };
  if (value <= 0.5) return { tone: "neutral" as const, note: "Low Yield" };
  return { tone: "positive" as const, note: "Shareholder Return" };
}

function highLowTone(currentPrice: number, target: number | null, type: "high" | "low") {
  if (!target || !currentPrice) return { tone: "neutral" as const, note: "Data unavailable" };
  const distance = Math.abs(currentPrice - target) / target;
  if (type === "high" && distance < 0.08) return { tone: "negative" as const, note: "Near 52W High" };
  if (type === "low" && distance < 0.12) return { tone: "positive" as const, note: "Near 52W Low" };
  return { tone: "neutral" as const, note: "Normal Range" };
}

function invertedSentimentColor(position: number) {
  const stops: [number, [number, number, number]][] = [
    [0, [52, 211, 153]], [25, [163, 230, 53]], [50, [250, 204, 21]],
    [75, [249, 115, 22]], [100, [220, 38, 38]],
  ];
  const clamped = Math.max(0, Math.min(100, position));
  let low = stops[0];
  let high = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (clamped >= stops[index][0] && clamped <= stops[index + 1][0]) {
      low = stops[index];
      high = stops[index + 1];
      break;
    }
  }
  const progress = (clamped - low[0]) / (high[0] - low[0] || 1);
  return `rgb(${low[1].map((channel, index) => Math.round(channel + (high[1][index] - channel) * progress)).join(", ")})`;
}

function formatReportDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${dateStr}T00:00:00`)
  );
}

export function FundamentalsGrid({
  metrics,
  marketCap,
  currentPrice,
  earnings = [],
  isEtf = false,
  show52WeekRange = false
}: {
  metrics?: Record<string, MetricValue>;
  marketCap?: number;
  currentPrice: number;
  earnings?: EarningsEvent[];
  isEtf?: boolean;
  show52WeekRange?: boolean;
}) {
  const pe = toNumber(metrics?.peTTM ?? metrics?.peNormalizedAnnual);
  const forwardPe = toNumber(metrics?.forwardPE ?? null);        // ✅ correct Finnhub field
  const peg = (() => {
    const raw = toNumber(metrics?.pegRatio);
    if (raw) return raw;
    if (!pe || pe <= 0) return null;
    const growth = toNumber(metrics?.epsGrowth5Y)
      ?? toNumber(metrics?.epsGrowth3Y)
      ?? toNumber(metrics?.revenueGrowth5Y)
      ?? toNumber(metrics?.revenueGrowth3Y);
    if (!growth || growth <= 0) return null;
    return pe / growth;
})();
  const eps = toNumber(metrics?.epsNormalizedAnnual ?? metrics?.epsTTM);
  const dividendYield = toNumber(metrics?.dividendYieldIndicatedAnnual);
  const beta = toNumber(metrics?.beta);
  const high52 = toNumber(metrics?.["52WeekHigh"]);
  const low52 = toNumber(metrics?.["52WeekLow"]);
  const volume = toNumber(metrics?.["10DayAverageTradingVolume"]);

  const nextReport = getNextReport(earnings);
  const expectedGrowth = nextReport ? expectedRevenueGrowthPct(earnings, nextReport) : null;

  const items: FundamentalItem[] = [
    {
      label: "Market Cap",
      value: formatCompact((marketCap ?? 0) * 1_000_000),
      tone: "neutral",
      note: "Company Size"
    },
    { label: "Beta", value: formatNumber(beta), ...ratioTone(beta, 0.8, 1.4) },
    {
      label: "P/E Ratio",
      value: pe !== null ? formatNumber(pe) : eps !== null && eps < 0 ? "Loss-making" : "N/A",
      ...(pe !== null
        ? ratioTone(pe, 15, 30)
        : eps !== null && eps < 0
        ? { tone: "negative" as const, note: "Negative EPS" }
        : { tone: "neutral" as const, note: "Data unavailable" })
    },
    {
      label: "Forward P/E",
      value: forwardPe !== null ? formatNumber(forwardPe) : eps !== null && eps < 0 ? "Loss-making" : "N/A",
      ...(forwardPe !== null
        ? ratioTone(forwardPe, 15, 28)
        : eps !== null && eps < 0
        ? { tone: "negative" as const, note: "Negative EPS" }
        : { tone: "neutral" as const, note: "Data unavailable" })
    },
    { label: "PEG", value: formatNumber(peg), ...ratioTone(peg, 1, 2) },
    {
      label: "EPS",
      value: formatCurrency(eps),
      tone: eps && eps > 0 ? "positive" : "negative",
      note: eps && eps > 0 ? "Profitable" : "Watch Earnings"
    },
    { label: "Avg. Volume", value: formatCompact(volume ? volume * 1_000_000 : null), tone: "neutral", note: "10 Day Avg." },
    { label: "Dividend Yield", value: formatPercent(dividendYield), ...dividendTone(dividendYield) },
    {
      label: "Next Report",
      value: nextReport ? formatReportDate(nextReport.date) : "N/A",
      tone: "neutral",
      note: nextReport ? `Q${nextReport.quarter} ${nextReport.year}` : "Not scheduled yet"
    },
    {
      label: "Expected Earnings",
      value: expectedGrowth !== null ? formatPercent(expectedGrowth) : "N/A",
      tone: expectedGrowth === null ? "neutral" : expectedGrowth >= 0 ? "positive" : "negative",
      note: expectedGrowth !== null ? "Est. QoQ Growth" : "Data unavailable"
    }
  ];

  if (!show52WeekRange) {
    items.splice(6, 0,
      { label: "52W Low", value: formatCurrency(low52), ...highLowTone(currentPrice, low52, "low") },
      { label: "52W High", value: formatCurrency(high52), ...highLowTone(currentPrice, high52, "high") }
    );
  }

  const ETF_EXCLUDED_LABELS = new Set([
    "Market Cap", "P/E Ratio", "Forward P/E", "PEG", "EPS", "Dividend Yield", "Next Report", "Expected Earnings"
  ]);
  const visibleItems = isEtf ? items.filter(item => !ETF_EXCLUDED_LABELS.has(item.label)) : items;
  const indicatorGroups = [
    ["Market Cap", "Beta", "P/E Ratio", "Forward P/E"],
    ["PEG", "EPS"],
    ["52W Low", "52W High", "Avg. Volume", "Dividend Yield"],
    ["Next Report", "Expected Earnings"],
  ].map((labels) => labels
    .map((label) => visibleItems.find((item) => item.label === label))
    .filter((item): item is FundamentalItem => item !== undefined))
    .filter((group) => group.length > 0);

  return (
    <section>
      <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-accent">
        <OptionalSvgIcon name="indicators" className="h-6 w-6" colorClassName="text-accent" />Indicators
      </p>
      <div className="mx-5 grid grid-cols-1 gap-y-2">
        {indicatorGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="grid grid-cols-2 gap-x-4 gap-y-2">
            {group.map((item) => (
              <div key={item.label} className="min-w-0 py-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    item.tone === "positive" ? "bg-positive" :
                    item.tone === "negative" ? "bg-negative" :
                    "bg-text-muted/40"
                  }`} />
                  <p className="truncate text-xs uppercase tracking-[0.12em] text-text-muted">{item.label}</p>
                </div>
                <p className="text-xl font-semibold text-text-primary"><WheelPrice value={item.value} size="md" compact /></p>
              </div>
            ))}
          </div>
        ))}
      </div>
      {show52WeekRange && high52 !== null && low52 !== null && high52 >= low52 && (
        <div className="mx-5 mt-2">
          <p className="mb-3 text-xs uppercase tracking-[0.12em] text-text-muted">52W Range</p>
          {(() => {
            // Low is at the left and high is at the right, like a range scale.
            const position = high52 === low52 ? 50 : ((currentPrice - low52) / (high52 - low52)) * 100;
            const clampedPosition = Math.max(0, Math.min(100, position));
            // Stock sentiment colors the filled portion from its current score.
            // Use one color across this full-width range, inverse toward red at 52W high.
            const color = invertedSentimentColor(clampedPosition);
            const glow = color.replace("rgb(", "rgba(").replace(")", ", 0.42)");
            return (
              <div className="w-full">
                <div className="mb-3 flex items-center justify-between gap-3 text-xl font-semibold text-text-primary">
                  <span>{formatCurrency(low52)}</span>
                  <span>{formatCurrency(high52)}</span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-panel-muted">
                  <div className="h-full w-full rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${glow}` }} />
                  <span
                    className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${clampedPosition}%`, backgroundColor: "var(--color-range-marker)" }}
                    aria-label={`Current price ${formatCurrency(currentPrice)}, position ${Math.round(clampedPosition)}% of the 52 week range`}
                    title={`Current price: ${formatCurrency(currentPrice)}`}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
}
