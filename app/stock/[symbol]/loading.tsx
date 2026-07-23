import { LoadingScreen } from "@/components/EmptyWatchlist";

export default function StockLoading() {
  return (
    <>
      {/* Mobile: instant full-screen black cover so there's no flash of the
          previous page, then the loading animation rises in */}
      <div className="lg:hidden fixed inset-0 z-50 bg-black flex flex-col items-center justify-center page-enter-rise">
        <LoadingScreen label="Loading stock data" />
      </div>
      {/* Desktop: no change */}
      <div className="hidden lg:block">
        <LoadingScreen label="Loading stock data" />
      </div>
    </>
  );
}
