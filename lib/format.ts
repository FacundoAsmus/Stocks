export function formatCurrency(value?: number | null, maximumFractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits
  }).format(value);
}

export function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompact(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatDateTime(unixSeconds?: number | null) {
  if (!unixSeconds) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(unixSeconds * 1000));
}
