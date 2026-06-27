import { LoadingScreen } from "@/components/EmptyWatchlist";

// Plain loading screen — no animation. The enter animation lives on
// MobileStockPage itself so it only fires when real content is ready.
export default function StockLoading() {
  return <LoadingScreen label="Loading stock data" />;
}
