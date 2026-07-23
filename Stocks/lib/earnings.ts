import type { EarningsEvent } from "@/types/stock";

// "Today" as a YYYY-MM-DD string, for comparing against event.date strings.
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// The next scheduled report (date >= today), or null if none is known yet.
export function getNextReport(earnings: EarningsEvent[]): EarningsEvent | null {
  const today = todayStr();
  return earnings.find(e => e.date >= today) ?? null;
}

// The most recently completed report (date < today) — i.e. the quarter
// immediately preceding a given event, used as the QoQ baseline.
export function getPreviousReport(earnings: EarningsEvent[], before: EarningsEvent): EarningsEvent | null {
  const idx = earnings.findIndex(e => e.date === before.date);
  if (idx <= 0) return null;
  // Walk backwards to the closest prior event that actually has an actual
  // reported value — skips over anything malformed.
  for (let i = idx - 1; i >= 0; i--) {
    if (earnings[i].revenueActual !== null || earnings[i].epsActual !== null) return earnings[i];
  }
  return null;
}

export function pctChange(current: number | null, base: number | null): number | null {
  if (current === null || base === null || base === 0) return null;
  return ((current - base) / Math.abs(base)) * 100;
}

// The QoQ growth expected for an upcoming quarter's revenue estimate,
// compared against the most recent quarter's actual revenue.
export function expectedRevenueGrowthPct(earnings: EarningsEvent[], event: EarningsEvent): number | null {
  const prev = getPreviousReport(earnings, event);
  return pctChange(event.revenueEstimate, prev?.revenueActual ?? null);
}

export function expectedEpsGrowthPct(earnings: EarningsEvent[], event: EarningsEvent): number | null {
  const prev = getPreviousReport(earnings, event);
  return pctChange(event.epsEstimate, prev?.epsActual ?? null);
}

// How a past quarter's actual result compared to what was expected.
export function revenueSurprisePct(event: EarningsEvent): number | null {
  return pctChange(event.revenueActual, event.revenueEstimate);
}

export function epsSurprisePct(event: EarningsEvent): number | null {
  return pctChange(event.epsActual, event.epsEstimate);
}

export function isReported(event: EarningsEvent, today = todayStr()): boolean {
  return event.date < today;
}

// Human-readable earnings-calendar block for the AI chat context — same
// idea as the other data blocks (Fundamentals, Graph Data, etc.): plain
// text the model can cite directly.
export function formatEarningsForAIContext(earnings: EarningsEvent[]): string | null {
  if (!earnings.length) return null;
  const today = todayStr();
  const fmtRev = (v: number | null) => v !== null ? `$${(v / 1_000_000_000).toFixed(2)}B` : "N/A";
  const fmtEps = (v: number | null) => v !== null ? `$${v.toFixed(2)}` : "N/A";
  const fmtPct = (v: number | null) => v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "N/A";

  const lines: string[] = [];

  // Every scheduled future quarter we know about — not just the nearest one.
  const upcoming = earnings.filter(e => e.date >= today);
  upcoming.forEach((e, i) => {
    const revGrowth = expectedRevenueGrowthPct(earnings, e);
    const epsGrowth = expectedEpsGrowthPct(earnings, e);
    const label = i === 0 ? "Next Report" : "Also Scheduled";
    lines.push(
      `${label}: ${e.date} (Q${e.quarter} ${e.year}) — ` +
      `Est. Revenue ${fmtRev(e.revenueEstimate)} (${fmtPct(revGrowth)} vs last qtr actual), ` +
      `Est. EPS ${fmtEps(e.epsEstimate)} (${fmtPct(epsGrowth)} vs last qtr actual)`
    );
  });

  const reported = earnings.filter(e => e.date < today).slice(-6).reverse();
  reported.forEach(e => {
    const revPct = revenueSurprisePct(e);
    const epsPct = epsSurprisePct(e);
    lines.push(
      `Q${e.quarter} ${e.year} (${e.date}, reported): ` +
      `Revenue ${fmtRev(e.revenueActual)} vs Est. ${fmtRev(e.revenueEstimate)} (${fmtPct(revPct)}) | ` +
      `EPS ${fmtEps(e.epsActual)} vs Est. ${fmtEps(e.epsEstimate)} (${fmtPct(epsPct)})`
    );
  });

  return lines.length ? `Earnings Calendar (list every line below if asked "what quarters do you know about" — do not stop at just the first one):\n${lines.join("\n")}` : null;
}
