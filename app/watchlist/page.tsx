import { Suspense } from "react";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { Watchlist } from "@/components/Watchlist";

export default function WatchlistPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading your watchlist" />}>
      <WatchlistReady />
    </Suspense>
  );
}

function WatchlistReady() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Watchlist</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary sm:text-4xl">
              Your Stocks
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">
              Track prices, daily moves, and quick trend lines.
            </p>
          </div>
        </section>
        <Watchlist />
      </div>
    </div>
  );
}
