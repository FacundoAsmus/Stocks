import { Suspense } from "react";

import { EmptyWatchlist } from "@/components/EmptyWatchlist";
import { Watchlist } from "@/components/Watchlist";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">Watchlist</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary sm:text-4xl">
            Your Stocks
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">
            Track prices, daily moves, and quick trend lines.
          </p>
        </div>
      </section>

      <Suspense fallback={<EmptyWatchlist isLoading />}>
        <Watchlist />
      </Suspense>
    </div>
  );
}
