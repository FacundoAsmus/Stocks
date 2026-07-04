// ── Portfolio Tracker data layer ─────────────────────────────────────────────
// Each entry represents a single purchase event (a "lot").
// Multiple lots for the same ticker are expected and handled in the UI.

export interface TrackerHolding {
  ticker: string;
  companyName: string;
  quantity: number;
  purchasePrice: number; // fetched from historical data at purchaseDate
  purchaseDate: string;  // ISO date string "YYYY-MM-DD"
  dateAdded: string;     // ISO datetime (when the user recorded it)
}

const TRACKER_KEY = "market-lens-tracker";

export function readTracker(): TrackerHolding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRACKER_KEY);
    return raw ? (JSON.parse(raw) as TrackerHolding[]) : [];
  } catch {
    return [];
  }
}

export function writeTracker(holdings: TrackerHolding[]) {
  window.localStorage.setItem(TRACKER_KEY, JSON.stringify(holdings));
  window.dispatchEvent(new Event("tracker-updated"));
}

export function addHolding(holding: Omit<TrackerHolding, "dateAdded">) {
  const current = readTracker();
  const next = [...current, { ...holding, dateAdded: new Date().toISOString() }];
  writeTracker(next);
  // Auto-add to watchlist if not already there
  const WL_KEY = "market-lens-watchlist";
  try {
    const wl: string[] = JSON.parse(window.localStorage.getItem(WL_KEY) ?? "[]");
    if (!wl.includes(holding.ticker)) {
      window.localStorage.setItem(WL_KEY, JSON.stringify([...wl, holding.ticker]));
      window.dispatchEvent(new Event("watchlist-updated"));
    }
  } catch { /* ignore */ }
}

export function removeHolding(index: number) {
  const current = readTracker();
  writeTracker(current.filter((_, i) => i !== index));
}

// ── Aggregated position per ticker (collapses all lots) ────────────────────
export interface AggregatedPosition {
  ticker: string;
  companyName: string;
  totalQuantity: number;
  avgPurchasePrice: number;
  lots: TrackerHolding[];
}

export function aggregateByTicker(holdings: TrackerHolding[]): AggregatedPosition[] {
  const map = new Map<string, AggregatedPosition>();
  for (const h of holdings) {
    const existing = map.get(h.ticker);
    if (existing) {
      existing.lots.push(h);
    } else {
      map.set(h.ticker, {
        ticker: h.ticker,
        companyName: h.companyName,
        totalQuantity: 0,
        avgPurchasePrice: 0,
        lots: [h],
      });
    }
  }
  // Compute weighted average purchase price
  for (const pos of map.values()) {
    const totalCost = pos.lots.reduce((s, l) => s + l.quantity * l.purchasePrice, 0);
    pos.totalQuantity = pos.lots.reduce((s, l) => s + l.quantity, 0);
    pos.avgPurchasePrice = pos.totalQuantity > 0 ? totalCost / pos.totalQuantity : 0;
  }
  return [...map.values()];
}

// ── Portfolio calculations ─────────────────────────────────────────────────
export function calcPortfolioValue(
  holdings: TrackerHolding[],
  prices: Map<string, number>
): number {
  const positions = aggregateByTicker(holdings);
  return positions.reduce((sum, p) => {
    const price = prices.get(p.ticker) ?? p.avgPurchasePrice;
    return sum + p.totalQuantity * price;
  }, 0);
}

export function calcTotalCost(holdings: TrackerHolding[]): number {
  return holdings.reduce((sum, h) => sum + h.quantity * h.purchasePrice, 0);
}

export function calcTodayChange(
  holdings: TrackerHolding[],
  prices: Map<string, number>,
  changes: Map<string, number>
): number {
  const totalValue = calcPortfolioValue(holdings, prices);
  if (!totalValue) return 0;
  const positions = aggregateByTicker(holdings);
  let weighted = 0;
  for (const p of positions) {
    const price = prices.get(p.ticker) ?? p.avgPurchasePrice;
    const pct = changes.get(p.ticker) ?? 0;
    const weight = (p.totalQuantity * price) / totalValue;
    weighted += pct * weight;
  }
  return weighted;
}
