"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { AnalystSection } from "@/components/AnalystSection";
import { FundamentalsGrid } from "@/components/FundamentalsGrid";
import { FilingIndicators } from "@/components/FilingIndicators";
import { MarketSentiment } from "@/components/MarketSentiment";
import { PriceChart, PriceHistoryLoadingAnimation } from "@/components/PriceChart";
import { CompanyDescription } from "@/components/CompanyDescription";
import { NewsSummary } from "@/components/NewsSummary";
import { NewsCard } from "@/components/NewsCard";
import { AIUnavailableNotice } from "@/components/AIUnavailableNotice";
import { StockLogo } from "@/components/StockLogo";
import { EarningsCalendarButton } from "@/components/mobile/EarningsCalendarButton";
import { SECTOR_ETFS } from "@/components/market/EtfList";
import { StockAIChat } from "@/components/mobile/StockAIChat";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import { StockPriceAlertButton } from "@/components/StockPriceAlertButton";
import { MobileCompareSearch } from "@/components/mobile/MobileCompareSearch";
import { StockComparisonView, type ComparisonDetailPayload } from "@/components/desktop/StockComparisonView";
import { MobileSettingsPanel } from "@/components/MobileNav";
import { isUsEquityMarketOpen } from "@/lib/usMarketHours";
import { subscribeToMarketRefresh } from "@/lib/marketRefresh";
import type { StockDetail } from "@/types/stock";

interface MobileStockPageProps {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

// Plays the search-close animation (fullscreen → tiny circle in bottom-right).

export function MobileStockPage(props: MobileStockPageProps) {
  const [liveData, setLiveData] = useState(props);
  const { stock, currentPrice, sentiment, metrics } = liveData;
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement>(null);
  const [fromSearch,       setFromSearch]       = useState(false);
  const [searchOrigin,     setSearchOrigin]     = useState<string>("/");
  const [compareSearchOpen, setCompareSearchOpen] = useState(false);
  const [comparisonSymbol, setComparisonSymbol] = useState<string | null>(null);
  const [comparisonDetail, setComparisonDetail] = useState<ComparisonDetailPayload | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [settingsPhase, setSettingsPhase] = useState<"closed" | "open" | "closing">("closed");
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

  useEffect(() => {
    setLiveData({ stock: props.stock, currentPrice: props.currentPrice, sentiment: props.sentiment, metrics: props.metrics });
  }, [props.stock, props.currentPrice, props.sentiment, props.metrics]);

  useEffect(() => {
    if (!comparisonSymbol || comparisonSymbol.toUpperCase() === stock.symbol.toUpperCase()) return;
    const controller = new AbortController();
    setComparisonLoading(true);
    setComparisonError(null);
    setComparisonDetail(null);
    fetch(`/api/stock-detail?symbol=${encodeURIComponent(comparisonSymbol)}&refresh=1`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as ComparisonDetailPayload & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? `Unable to load ${comparisonSymbol}.`);
        if (!controller.signal.aborted) setComparisonDetail(payload);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setComparisonError(error instanceof Error ? error.message : `Unable to load ${comparisonSymbol}.`);
      })
      .finally(() => { if (!controller.signal.aborted) setComparisonLoading(false); });
    return () => controller.abort();
  }, [comparisonSymbol, stock.symbol]);

  useEffect(() => {
    if (comparisonSymbol) window.scrollTo(0, 0);
  }, [comparisonSymbol]);

  useEffect(() => {
    let inFlight = false;
    let controller: AbortController | null = null;
    const refresh = () => {
      if (inFlight || !isUsEquityMarketOpen()) return;
      inFlight = true;
      controller = new AbortController();
      fetch(`/api/stock-detail?symbol=${encodeURIComponent(props.stock.symbol)}&refresh=1`, { cache: "no-store", signal: controller.signal })
        .then(async response => {
          const payload = await response.json() as MobileStockPageProps & { error?: string };
          if (!response.ok) throw new Error(payload.error ?? "Unable to refresh stock data.");
          setLiveData(payload);
          window.dispatchEvent(new CustomEvent("stock-data-refreshed", { detail: { symbol: props.stock.symbol } }));
        })
        .catch(() => undefined)
        .finally(() => { inFlight = false; });
    };
    refresh();
    const unsubscribe = subscribeToMarketRefresh(refresh);
    return () => { unsubscribe(); controller?.abort(); };
  }, [props.stock.symbol]);

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

  function closeSettings() {
    if (settingsPhase !== "open") return;
    setSettingsPhase("closing");
    window.setTimeout(() => setSettingsPhase("closed"), 260);
  }

  return (
    <>
      {/* AI Chat — self-contained floating pill + overlay, mounted always */}
      <StockAIChat
        stock={stock}
        currentPrice={currentPrice}
        sentiment={sentiment}
        metrics={metrics}
        comparisonStock={comparisonDetail ?? undefined}
        hideTrigger={settingsPhase !== "closed"}
      />
      {settingsPhase !== "closed" && <MobileSettingsPanel closing={settingsPhase === "closing"} onClose={closeSettings} />}
      <MobileCompareSearch
        primarySymbol={stock.symbol}
        open={compareSearchOpen}
        onOpenChange={setCompareSearchOpen}
        onSelect={(symbol) => {
          if (symbol.toUpperCase() === stock.symbol.toUpperCase()) return;
          setComparisonLoading(true);
          setComparisonError(null);
          setComparisonSymbol(symbol);
          setComparisonDetail(null);
        }}
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
        <span className="invisible flex items-center justify-center h-[2.45rem] w-[2.45rem] rounded-full" aria-hidden>
          <OptionalSvgIcon name="back" className="h-5 w-5" />
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label={`Compare ${stock.symbol} with another stock`} title="Compare stocks" onClick={() => setCompareSearchOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-accent transition hover:bg-white/5">
            <OptionalSvgIcon name="compare" className="h-6 w-6" color="var(--color-accent)" />
          </button>
          <button type="button" aria-label="Settings" title="Settings" onClick={() => { setCompareSearchOpen(false); setSettingsPhase("open"); }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-accent transition hover:bg-white/5">
            <OptionalSvgIcon name="settings" className="h-6 w-6" />
          </button>
          <StockPriceAlertButton symbol={stock.symbol} name={stock.profile.name ?? stock.symbol} currentPrice={currentPrice} mobile mobileHeader />
        </div>
      </div>

      {/* The real, clickable Back button — portaled straight onto
          document.body (same pattern StockAIChat already uses reliably)
          so it's never nested inside the blurred header's own stacking
          context. That local nesting is what kept letting the blur end up
          rendered over the button despite z-index/isolate/transform
          attempts from inside the header itself. */}
      {mounted && settingsPhase === "closed" && createPortal(
        <button
          onClick={handleBack}
          aria-label="Back"
          className="fixed flex items-center justify-center h-[2.45rem] w-[2.45rem] text-accent"
          style={{
            top: "calc(0.75rem + env(safe-area-inset-top))",
            left: "1rem",
            zIndex: 500,
            background: "transparent",
          }}
        >
          <OptionalSvgIcon name="back" className="h-5 w-5" />
        </button>,
        document.body
      )}

      <div ref={pageRef} className="pb-36" style={{ opacity: 1 }} data-stock-page="">
        {comparisonSymbol ? (
          comparisonLoading ? (
            <div className="h-[260px] px-3"><PriceHistoryLoadingAnimation /></div>
          ) : comparisonError ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-text-muted">Unable to compare {comparisonSymbol}: {comparisonError}</p>
              <button type="button" className="mt-4 text-sm text-accent underline" onClick={() => { setComparisonSymbol(null); setComparisonDetail(null); }}>
                Return to {stock.symbol}
              </button>
            </div>
          ) : comparisonDetail ? (
            <StockComparisonView
              primary={{ stock, currentPrice, sentiment, metrics }}
              secondary={comparisonDetail}
              mobile
              onRemovePrimary={() => {
                const next = comparisonDetail;
                setLiveData(next);
                setComparisonSymbol(null);
                setComparisonDetail(null);
                router.push(`/stock/${next.stock.symbol}`);
              }}
              onRemoveSecondary={() => { setComparisonSymbol(null); setComparisonDetail(null); }}
            />
          ) : null
        ) : <>
        <div className="flex items-center gap-3 px-4 pt-5 pb-3">
          <StockLogo logo={!isEtf ? stock.profile.logo : undefined} symbol={stock.symbol} size={48}
            sizeClassName="h-12 w-12 shrink-0"
            imageClassName="h-12 w-12 rounded-3xl border border-white/10 bg-white/5 object-contain shrink-0"
            fallbackClassName="h-12 w-12 shrink-0 rounded-3xl object-contain" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text-primary leading-tight truncate">{stock.profile.name ?? stock.symbol}</h1>
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
            hideCursorDateTooltip
          />
        </div>

        <div className="flex flex-col gap-4 px-2 mt-4">
          <MarketSentiment score={sentiment.score} drivers={sentiment.drivers} />

          {!isEtf && (
            <AnalystSection
              recommendations={stock.recommendations}
              priceTarget={stock.priceTarget}
              currentPrice={currentPrice}
            />
          )}

          <FundamentalsGrid
            metrics={metrics}
            marketCap={stock.profile.marketCapitalization}
            currentPrice={currentPrice}
            earnings={stock.earnings}
            isEtf={isEtf}
          />

          {!isEtf && (
            <div className="flex justify-end -mb-4">
              <EarningsCalendarButton earnings={stock.earnings} />
            </div>
          )}

          {!isEtf && <FilingIndicators symbol={stock.symbol} compact />}

          {(stock.news.length > 0 || stock.newsUnavailable) && (
            <section className="px-3">
              <p className="-ml-3 mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent"><OptionalSvgIcon name="news" className="h-5 w-5" />News</p>
              {stock.newsUnavailable ? <AIUnavailableNotice /> : <>
                <NewsSummary symbol={stock.symbol} articles={stock.news} />
                <div className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2">
                  {stock.news.slice(0, 8).map(article => (
                    <div key={article.id} className="w-[38vw] max-w-[140px] shrink-0 snap-start">
                      <NewsCard article={article} />
                    </div>
                  ))}
                </div>
              </>}
            </section>
          )}

          <CompanyDescription symbol={stock.symbol} className="px-3" />
        </div>
        </>}
      </div>
    </>
  );
}
