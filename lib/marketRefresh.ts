import { isUsEquityMarketOpen } from "@/lib/usMarketHours";

export const MARKET_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function subscribeToMarketRefresh(callback: () => void) {
  let lastRun = Date.now();
  const refreshIfNeeded = () => {
    const now = Date.now();
    if (document.visibilityState !== "visible" || !isUsEquityMarketOpen() || now - lastRun < 5_000) return;
    lastRun = now;
    callback();
  };

  const timer = window.setInterval(refreshIfNeeded, MARKET_REFRESH_INTERVAL_MS);
  window.addEventListener("focus", refreshIfNeeded);
  window.addEventListener("pageshow", refreshIfNeeded);
  document.addEventListener("visibilitychange", refreshIfNeeded);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", refreshIfNeeded);
    window.removeEventListener("pageshow", refreshIfNeeded);
    document.removeEventListener("visibilitychange", refreshIfNeeded);
  };
}
