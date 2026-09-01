import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { expectedRevenueGrowthPct, getNextReport } from "@/lib/earnings";
import type { EarningsEvent } from "@/types/stock";

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

  if (type === "high" && distance < 0.08) {
    return { tone: "negative" as const, note: "Near 52W High" };
  }

  if (type === "low" && distance < 0.12) {
    return { tone: "positive" as const, note: "Near 52W Low" };
  }

  return { tone: "neutral" as const, note: "Normal Range" };
}

function formatReportDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${dateStr}T00:00:00`)
  );
}

function toneClasses(tone: FundamentalItem["tone"]) {
  if (tone === "positive") return "border-positive/25 bg-positive/5 text-positive";
  if (tone === "negative") return "border-negative/25 bg-negative/5 text-negative";
  return "border-border-subtle bg-panel text-text-muted";
}

export function FundamentalsGrid({
  metrics,
  marketCap,
  currentPrice,
  earnings = [],
  isEtf = false
}: {
  metrics?: Record<string, MetricValue>;
  marketCap?: number;
  currentPrice: number;
  earnings?: EarningsEvent[];
  isEtf?: boolean;
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
    { label: "Dividend Yield", value: formatPercent(dividendYield), ...dividendTone(dividendYield) },
    { label: "Beta", value: formatNumber(beta), ...ratioTone(beta, 0.8, 1.4) },
    { label: "52W High", value: formatCurrency(high52), ...highLowTone(currentPrice, high52, "high") },
    { label: "52W Low", value: formatCurrency(low52), ...highLowTone(currentPrice, low52, "low") },
    { label: "Avg. Volume", value: formatCompact(volume ? volume * 1_000_000 : null), tone: "neutral", note: "10 Day Avg." },
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

  const ETF_EXCLUDED_LABELS = new Set([
    "Market Cap", "P/E Ratio", "Forward P/E", "PEG", "EPS", "Dividend Yield", "Next Report", "Expected Earnings"
  ]);
  const visibleItems = isEtf ? items.filter(item => !ETF_EXCLUDED_LABELS.has(item.label)) : items;

  return (
    <section className="grid grid-cols-2 gap-2">
      {visibleItems.map((item) => (
        <div key={item.label} className="rounded-md bg-black p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`h-2 w-2 rounded-full shrink-0 ${
              item.tone === "positive" ? "bg-positive" :
              item.tone === "negative" ? "bg-negative" :
              "bg-text-muted/40"
            }`} />
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted truncate">{item.label}</p>
          </div>
          <p className="text-xl font-semibold text-text-primary">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
