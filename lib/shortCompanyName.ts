const SHORT_NAMES: Record<string, string> = {
  AMD: "AMD",
  TSM: "TSMC",
  META: "Meta",
  GOOGL: "Google",
  GOOG: "Google",
  "BRK.B": "Berkshire Hathaway",
};

const CORPORATE_SUFFIX = /\b(incorporated|inc|corporation|corp|company|co|ltd|limited|plc|holdings?|group|sa|nv|ag|lp)\b\.?[,]?/gi;

export function shortCompanyName(symbol: string, name?: string | null, displayName?: string | null) {
  const normalizedSymbol = symbol.toUpperCase();
  if (SHORT_NAMES[normalizedSymbol]) return SHORT_NAMES[normalizedSymbol];

  const shortDisplayName = displayName?.trim();
  if (shortDisplayName && shortDisplayName.length <= 24) return shortDisplayName;

  const cleaned = (name ?? "")
    .replace(CORPORATE_SUFFIX, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s.]+$/, "")
    .trim();
  return cleaned || symbol;
}
