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
  // Full-bleed: no outer max-width/padding box. The split view fills the
  // remaining viewport height below the sticky header edge-to-edge.
  return <WatchlistSplitView />;
}
