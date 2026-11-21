const SHORT_NAMES: Record<string, string> = {
  AMD: "AMD",
  META: "Meta",
  AMZN: "Amazon",
  ANT: "Anthropic",
  MU: "Micron",
  "BRK.B": "Berkshire Hathaway",
};

const COMPANY_SUFFIXES = /\b(incorporated|inc|corporation|corp|company|co|ltd|limited|plc|holdings?|group|sa|nv|ag|lp|technologies?|platforms?)\b\.?/gi;

export function shortCompanyName(symbol: string, name?: string | null): string {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const override = SHORT_NAMES[normalizedSymbol];
  if (override) return override;

  const cleanedName = (name ?? "")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[,.&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedName || symbol;
}
