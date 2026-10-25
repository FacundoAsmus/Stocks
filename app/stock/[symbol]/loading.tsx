import { LoadingScreen } from "@/components/EmptyWatchlist";
import { StockPageSkeleton } from "@/components/mobile/StockPageSkeleton";

export default function StockLoading() {
  return (
    <>
      {/* The StockSheet covers non-stock navigation; this fallback is for
          direct stock-to-stock navigation on phones. */}
      <div className="lg:hidden">
        <StockPageSkeleton />
      </div>
      {/* Desktop: no change */}
      <div className="hidden lg:block">
        <LoadingScreen label="Loading stock data" />
      </div>
    </>
  );
}
