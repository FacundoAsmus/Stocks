import { Loader2, Star } from "lucide-react";

export function EmptyWatchlist({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <section className="rounded-md border border-dashed border-border-subtle bg-panel/70 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-panel-muted text-accent">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Star className="h-5 w-5" aria-hidden />
        )}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-text-primary">
        {isLoading ? "Loading your watchlist" : "Your watchlist is empty"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
        {isLoading
          ? "Fetching the latest quote and sparkline data."
          : "Search for a company or ticker above, open its detail page, and add it to your watchlist."}
      </p>
    </section>
  );
}
