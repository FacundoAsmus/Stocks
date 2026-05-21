import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/format";

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

function toneClasses(tone: FundamentalItem["tone"]) {
  if (tone === "positive") return "border-positive/25 bg-positive/5 text-positive";
  if (tone === "negative") return "border-negative/25 bg-negative/5 text-negative";
  return "border-border-subtle bg-panel text-text-muted";
}

export function FundamentalsGrid({
  metrics,
  marketCap,
  currentPrice
}: {
  metrics?: Record<string, MetricValue>;
  marketCap?: number;
  currentPrice: number;
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
    { label: "Avg. Volume", value: formatCompact(volume ? volume * 1_000_000 : null), tone: "neutral", note: "10 Day Avg." }
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border-subtle bg-panel p-4 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:shadow-xl hover:shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{item.label}</p>
            <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${toneClasses(item.tone)}`}>
              {item.note}
            </span>
          </div>
          <p className="mt-3 text-xl font-semibold text-text-primary">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
