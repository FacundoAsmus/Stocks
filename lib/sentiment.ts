// Extracted from app/stock/[symbol]/page.tsx so the same sentiment math can
// be reused both by the standalone stock page (server-rendered) and by the
// new /api/stock-detail route that powers the desktop watchlist split view.

export function metricValue(metrics: Record<string, number | string | null> | undefined, key: string) {
  const value = metrics?.[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function getSentimentScore({
  changePercent,
  beta,
  pe,
  high52,
  low52,
  currentPrice
}: {
  changePercent: number | null;
  beta: number | null;
  pe: number | null;
  high52: number | null;
  low52: number | null;
  currentPrice: number;
}) {
  let score = 50;
  const drivers: string[] = [];

  // Daily momentum — primary signal (60% of the score movement)
  if (changePercent !== null) {
    score += clamp(changePercent * 3, -15, 15);
    drivers.push(changePercent >= 1 ? "Strong positive momentum"
      : changePercent >= 0 ? "Positive daily momentum"
      : changePercent > -1 ? "Slight negative momentum"
      : "Negative daily momentum");
  }

  // 52W range position — strong sentiment signal
  if (high52 && low52 && currentPrice) {
    const rangePosition = ((currentPrice - low52) / (high52 - low52)) * 100;
    if (rangePosition > 85) {
      score += 12;
      drivers.push("Near 52-week high");
    } else if (rangePosition > 60) {
      score += 5;
      drivers.push("Upper 52-week range");
    } else if (rangePosition < 20) {
      score -= 12;
      drivers.push("Near 52-week low");
    } else if (rangePosition < 40) {
      score -= 5;
      drivers.push("Lower 52-week range");
    } else {
      drivers.push("Mid 52-week range");
    }
  }

  // P/E — only flag extremes, don't penalize normal growth premiums
  if (pe !== null && pe > 0) {
    if (pe < 12) {
      score += 5;
      drivers.push("Deep value P/E");
    } else if (pe > 80) {
      score -= 8;
      drivers.push("Extreme valuation (P/E > 80)");
    } else if (pe > 60) {
      score -= 4;
      drivers.push("High valuation (P/E > 60)");
    }
    // 12–60 P/E: no penalty — covers most legitimate growth stocks
  }

  // Beta — informational only, very small weight
  if (beta !== null) {
    if (beta < 0.6) {
      score += 3;
      drivers.push("Low volatility stock");
    } else if (beta > 2) {
      score -= 3;
      drivers.push("High volatility stock");
    }
  }

  return {
    score: Math.round(clamp(score)),
    drivers: drivers.length ? drivers : ["Limited sentiment inputs available"]
  };
}
