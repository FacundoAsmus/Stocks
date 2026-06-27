import { LoadingScreen } from "@/components/EmptyWatchlist";

export default function StockLoading() {
  return (
    <div className="lg:hidden page-enter-rise">
      <LoadingScreen label="Loading stock data" />
    </div>
  );
}
