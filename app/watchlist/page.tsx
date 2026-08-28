import { WatchlistSplitView } from "@/components/desktop/WatchlistSplitView";
import { MobileWatchlist } from "@/components/mobile/MobileWatchlist";

export default function WatchlistPage() {
  return (
    <>
      {/* Desktop — merged watchlist + individual stock page (split view) */}
      <div className="hidden lg:block">
        <WatchlistDesktop />
      </div>

      {/* Mobile — unchanged */}
      <div className="lg:hidden">
        <MobileWatchlist />
      </div>
    </>
  );
}

function WatchlistDesktop() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Watchlist</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary sm:text-4xl">Your Stocks</h1>
          </div>
        </section>
        <WatchlistSplitView />
      </div>
    </div>
  );
}
