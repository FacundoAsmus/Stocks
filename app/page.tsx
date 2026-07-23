import { Suspense } from "react";
import { LoadingScreen } from "@/components/EmptyWatchlist";
import { MarketHome } from "@/components/market/MarketHome";
import { MobileMarket } from "@/components/mobile/MobileMarket";

export default function HomePage() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <Suspense fallback={<LoadingScreen label="Loading market data" />}>
          <MarketHome />
        </Suspense>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <MobileMarket />
      </div>
    </>
  );
}
