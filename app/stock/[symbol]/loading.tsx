import { LoadingScreen } from "@/components/EmptyWatchlist";
import { StockPageSkeleton } from "@/components/mobile/StockPageSkeleton";

export default function StockLoading() {
  return (
    <>
      {/* The transition sheet hides this for non-stock navigation. This remains
          the fallback for stock-to-stock navigation, which has no sheet. */}
      <div className="phone-stock-loading-fallback lg:hidden">
        <StockPageSkeleton />
      </div>
      {/* Desktop: unchanged */}
      <div className="hidden lg:block">
        <LoadingScreen label="Loading stock data" />
      </div>
    </>
  );
}
