"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { AnalystSection } from "@/components/AnalystSection";
import { FundamentalsGrid } from "@/components/FundamentalsGrid";
import { MarketSentiment } from "@/components/MarketSentiment";
import { PriceChart } from "@/components/PriceChart";
import { EarningsCalendarButton } from "@/components/mobile/EarningsCalendarButton";
import { SECTOR_ETFS } from "@/components/market/EtfList";
import { StockAIChat } from "@/components/mobile/StockAIChat";
import { cn } from "@/lib/utils";
import type { StockDetail } from "@/types/stock";

interface MobileStockPageProps {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

// Plays the search-close animation (fullscreen → tiny circle in bottom-right).

export function MobileStockPage({ stock, currentPrice, sentiment, metrics }: MobileStockPageProps) {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement>(null);
  const [fromSearch,       setFromSearch]       = useState(false);
  const [searchOrigin,     setSearchOrigin]     = useState<string>("/");
  // ETFs don't file earnings reports the way individual companies do, so an
  // earnings calendar doesn't apply to them.
  const isEtf = SECTOR_ETFS.some(e => e.symbol === stock.symbol);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const flag = sessionStorage.getItem("nav-from-search");
    if (flag) {
      setFromSearch(true);
      sessionStorage.removeItem("nav-from-search");
      setSearchOrigin(sessionStorage.getItem("search-origin") ?? "/");
    }
    const el = pageRef.current;
    if (el) {
      el.classList.add("page-enter-rise");
      el.addEventListener("animationend", () => el.classList.remove("page-enter-rise"), { once: true });
    }
  }, []);

  // Reset scroll to the top whenever the viewed stock changes — not just on
  // first mount. Next.js reuses this same page component instance (rather
  // than remounting it) when navigating directly from one stock page to
  // another, so a mount-only effect misses that case and the page opens
  // wherever the previous stock happened to be scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stock.symbol]);

  function handleBack() {
    const el = pageRef.current;
    if (el) {
      el.classList.add("page-exit-sink");
      setTimeout(() => {
        if (fromSearch) router.push(searchOrigin as "/" | "/watchlist");
        else router.back();
      }, 380);
    } else {
      if (fromSearch) router.push(searchOrigin as "/" | "/watchlist");
      else router.back();
    }
  }

  return (
    <>
      {/* AI Chat — self-contained floating pill + overlay, mounted always */}
      <StockAIChat
        stock={stock}
        currentPrice={currentPrice}
        sentiment={sentiment}
        metrics={metrics}
      />

      <div
        className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 pb-3"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        {/* Invisible — exists only to hold the same layout height as the
            real button below, so page content doesn't jump. */}
        <span className="invisible flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg" aria-hidden>
          <ChevronLeft className="h-4 w-4" />
          Back
        </span>
      </div>

      {/* The real, clickable Back button — portaled straight onto
          document.body (same pattern StockAIChat already uses reliably)
          so it's never nested inside the blurred header's own stacking
          context. That local nesting is what kept letting the blur end up
          rendered over the button despite z-index/isolate/transform
          attempts from inside the header itself. */}
      {mounted && createPortal(
        <button
          onClick={handleBack}
          className="fixed flex items-center gap-1.5 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ top: "calc(0.75rem + env(safe-area-inset-top))", left: "1rem", zIndex: 500 }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>,
        document.body
      )}

      <div ref={pageRef} className="pb-24" style={{ opacity: 1 }} data-stock-page="">

        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          {stock.profile.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stock.profile.logo} alt=""
              className="h-12 w-12 rounded-md border border-white/10 bg-white/5 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }} />
          ) : null}
          <span className={cn(
            "h-12 w-12 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted font-bold shrink-0",
            stock.profile.logo && "hidden",
            isEtf ? "text-text-primary text-[11px]" : "text-sm text-text-primary"
          )}>
            {isEtf ? "ETF" : stock.symbol.replace("^", "").slice(0, 2)}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary leading-tight truncate">{stock.profile.name ?? stock.symbol}</h1>
            <p className="text-xs text-text-muted">{stock.symbol}</p>
          </div>
          <AddToWatchlistButton symbol={stock.symbol} name={stock.profile.name ?? stock.symbol} compact />
        </div>

        <div className="px-2">
          <PriceChart
            symbol={stock.symbol}
            currentPrice={currentPrice}
            currentChangePercent={stock.quote.dp ?? 0}
            previousClose={stock.quote.pc ?? undefined}
            heightClassName="h-[260px]"
          />
        </div>

        <div className="flex flex-col gap-4 px-2 mt-4">
          <MarketSentiment score={sentiment.score} drivers={sentiment.drivers} />

          <AnalystSection
            recommendations={stock.recommendations}
            priceTarget={stock.priceTarget}
            currentPrice={currentPrice}
          />

          <FundamentalsGrid
            metrics={metrics}
            marketCap={stock.profile.marketCapitalization}
            currentPrice={currentPrice}
            earnings={stock.earnings}
            isEtf={isEtf}
          />

          {!isEtf && (
            <div className="flex justify-end -mt-2">
              <EarningsCalendarButton earnings={stock.earnings} />
            </div>
          )}

          {stock.news.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-3">News</p>
              <div className="flex flex-col gap-3">
                {stock.news.slice(0, 8).map(article => (
                  <a key={article.id} href={article.url} target="_blank" rel="noreferrer"
                    className="flex gap-3 rounded-xl bg-black p-3 active:opacity-80">
                    {article.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={article.image} alt="" className="h-[53px] w-[70px] rounded-md object-cover shrink-0 self-start" />
                      : <span className="h-[53px] w-[70px] rounded-md bg-white/5 shrink-0" />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-text-primary leading-snug line-clamp-2">{article.headline}</span>
                      <span className="block mt-1 text-[10px] text-text-muted">{article.source}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
