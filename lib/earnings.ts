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
