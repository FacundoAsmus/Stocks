import { LoadingScreen } from "@/components/EmptyWatchlist";

// This only renders when Next.js needs to actually fetch data server-side.
// The rise animation on the page itself handles the visual entrance.
export default function StockLoading() {
  return <LoadingScreen label="Loading stock data" />;
}
