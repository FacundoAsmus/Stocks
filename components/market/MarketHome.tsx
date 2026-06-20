"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { ErrorState } from "@/components/ErrorState";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketNewsArticle, StockSummary } from "@/types/stock";

const STORAGE_KEY = "market-lens-watchlist";

type MarketPayload = {
  tickerStocks?: StockSummary[];
  gainers?: StockSummary[];
  losers?: StockSummary[];
  news?: MarketNewsArticle[];
  error?: string;
};

function readWatchlist() {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function MiniSparkline({ stock, className }: { stock: StockSummary; className?: string }) {
  const isPositive = (stock.changePercent ?? 0) >= 0;
  const data = stock.sparkline?.length
    ? stock.sparkline
    : [
        { time: 0, close: (stock.price ?? 0) - (stock.change ?? 0) },
        { time: 1, close: stock.price ?? 0 }
      ];

  return (
    <div className={cn("h-10 w-20", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 6, bottom: 6 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="monotone"
            dataKey="close"
            stroke={isPositive ? "#00c805" : "#ff3003"}
            fill="transparent"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TickerBar({ stocks }: { stocks: StockSummary[] }) {
  const tickerStocks = stocks.length ? [...stocks, ...stocks] : [];

  if (!tickerStocks.length) {
    return (
      <div className="border-y border-border-subtle bg-black py-5 text-sm text-text-muted">
        Market tape unavailable
      </div>
    );
  }

  return (
    <section className="sticky top-[97px] z-30 w-screen overflow-hidden border-y border-border-subtle bg-black">
      <div className="market-ticker flex w-max items-stretch">
        {tickerStocks.map((stock, index) => {
          const isPositive = (stock.changePercent ?? 0) >= 0;
          return (
            <Link
              key={`${stock.symbol}-${index}`}
              href={`/stock/${encodeURIComponent(stock.symbol)}`}
              className="flex min-w-[282px] items-center gap-4 border-x border-border-subtle/80 px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:border-positive/60 hover:bg-panel-muted/80 hover:shadow-2xl hover:shadow-black/40"
            >
              <span className="min-w-[78px]">
                <span className="block truncate text-sm font-bold text-text-primary">{stock.symbol}</span>
                <span className={cn("block truncate text-xs font-semibold", isPositive ? "text-positive" : "text-negative")}>
                  {formatPercent(stock.changePercent)}
                </span>
              </span>
              <MiniSparkline stock={stock} />
              <span
                className={cn(
                  "min-w-[92px] rounded-md border px-3 py-2 text-center text-sm font-bold text-black",
                  isPositive
                    ? "border-positive/50 bg-positive !text-black"
                    : "border-negative/70 bg-negative !text-black"
                )}
              >
                {formatCurrency(stock.price)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MoverRow({ stock }: { stock: StockSummary }) {
  const isPositive = (stock.changePercent ?? 0) >= 0;

  return (
    <div className="group grid min-h-[58px] grid-cols-[34px_minmax(76px,0.95fr)_minmax(104px,1.25fr)_minmax(92px,auto)_40px] items-center gap-3 border border-transparent border-b-border-subtle/70 px-3 py-3 transition-all duration-200 hover:-translate-y-1 hover:border-positive/50 hover:bg-panel-muted/75 hover:shadow-2xl hover:shadow-black/25">
      <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} aria-label={`Open ${stock.symbol}`}>
        {stock.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stock.logo}
            alt=""
            className="h-8 w-8 rounded-md border border-white/10 bg-white/5 object-contain"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-[10px] font-bold text-text-primary">
            {stock.symbol.replace("^", "").slice(0, 2)}
          </span>
        )}
      </Link>
      <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} className="min-w-0">
        <span className="block truncate text-xs font-bold text-text-primary">{stock.symbol}</span>
        <span className={cn("block text-xs font-semibold", isPositive ? "text-positive" : "text-negative")}>
          {formatPercent(stock.changePercent)}
        </span>
      </Link>
      <Link href={`/stock/${encodeURIComponent(stock.symbol)}`} aria-label={`Open ${stock.symbol}`}>
        <MiniSparkline stock={stock} className="mr-auto h-8 w-full max-w-[112px]" />
      </Link>
      <Link
        href={`/stock/${encodeURIComponent(stock.symbol)}`}
        className={cn(
          "min-w-[92px] rounded-md border px-2 py-2 text-center text-xs font-bold !text-black",
          isPositive
            ? "border-positive/40 bg-positive"
            : "border-negative/60 bg-negative"
        )}
      >
        {formatCurrency(stock.price)}
      </Link>
      <AddToWatchlistButton symbol={stock.symbol} name={stock.name} compact />
    </div>
  );
}

function MoversList({ title, stocks }: { title: string; stocks: StockSummary[] }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-semibold tracking-normal text-text-primary">{title}</h2>
      <div className="rounded-lg border border-border-subtle bg-black p-2 shadow-2xl shadow-black/20">
        {stocks.length ? (
          stocks.slice(0, 10).map((stock) => <MoverRow key={stock.symbol} stock={stock} />)
        ) : (
          <p className="py-8 text-sm text-text-muted">Market movers unavailable.</p>
        )}
      </div>
    </section>
  );
}

function NewsPanel({ articles }: { articles: MarketNewsArticle[] }) {
  const main = articles[0];
  const side = articles.slice(1, 5);
  const bottom = articles.slice(5, 11);

  return (
    <section>
      <h2 className="mb-4 text-2xl font-semibold tracking-normal text-text-primary">News</h2>
      {!main ? (
        <div className="border-y border-border-subtle py-10 text-sm text-text-muted">Market news unavailable.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.75fr)]">
          <a
            href={main.url}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-md border border-border-subtle bg-panel transition-all duration-200 hover:-translate-y-1 hover:border-positive/50 hover:shadow-2xl hover:shadow-black/30"
          >
            {main.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.image} alt="" className="h-72 w-full object-cover" />
            ) : null}
            <div className="p-5">
              <h3 className="text-2xl font-bold leading-8 text-text-primary">{main.headline}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-text-muted">{main.summary}</p>
              <p className="mt-3 text-xs text-text-muted">
                {main.source || "Market news"} / {formatDateTime(main.datetime)}
              </p>
            </div>
          </a>

          <div className="rounded-md border border-border-subtle bg-panel p-4">
            <h3 className="mb-3 text-sm font-bold text-text-primary">Top Stories</h3>
            <div className="space-y-3">
              {side.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid grid-cols-[72px_1fr] gap-3 rounded-md border border-transparent p-2 transition-all duration-200 hover:-translate-y-1 hover:border-positive/50 hover:bg-panel-muted hover:shadow-xl hover:shadow-black/25"
                >
                  {article.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.image} alt="" className="h-14 w-[72px] rounded-md object-cover" />
                  ) : (
                    <span className="h-14 w-[72px] rounded-md bg-panel-muted" />
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-xs font-semibold leading-5 text-text-primary">{article.headline}</span>
                    <span className="mt-1 block text-xs text-text-muted">{article.source || "Market news"}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
            {bottom.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-md border border-border-subtle bg-panel transition-all duration-200 hover:-translate-y-1 hover:border-positive/50"
              >
                {article.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.image} alt="" className="h-28 w-full object-cover" />
                ) : null}
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-bold leading-5 text-text-primary">{article.headline}</h3>
                  <p className="mt-2 text-xs text-text-muted">{article.source || "Market news"}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function MarketHome() {
  const [data, setData] = useState<MarketPayload>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialWatchlist] = useState<string[]>(() => readWatchlist());

  const watchlistQuery = useMemo(() => initialWatchlist.join(","), [initialWatchlist]);
  const sentimentColor = useMemo(() => {
    const stocks = [...(data.gainers ?? []), ...(data.losers ?? [])];
    if (!stocks.length) return "transparent";
    const greenCount = stocks.filter((stock) => (stock.changePercent ?? 0) > 0).length;
    const redCount = stocks.filter((stock) => (stock.changePercent ?? 0) < 0).length;
    if (greenCount > redCount) return "rgba(0, 200, 5, 0.22)";
    if (redCount > greenCount) return "rgba(255, 48, 3, 0.22)";
    return "rgba(250, 204, 21, 0.14)";
  }, [data.gainers, data.losers]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMarket() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/market?watchlist=${encodeURIComponent(watchlistQuery)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as MarketPayload;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load market data.");
        setData(payload);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load market data.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadMarket();
    return () => controller.abort();
  }, [watchlistQuery]);

  if (error) return <ErrorState title="Market unavailable" message={error} />;

  return (
    <div className="relative -mt-8 min-h-dvh w-screen ml-[calc(50%-50vw)]">
      <div
        className="fixed inset-0 z-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `linear-gradient(to top, ${sentimentColor} 0%, rgba(0, 0, 0, 0) 72%)`,
          pointerEvents: "none"
        }}
      />
      <div className="relative z-10">
        <TickerBar stocks={data.tickerStocks ?? []} />

        {isLoading ? (
          <div className="grid gap-8 px-5 pt-20 lg:grid-cols-[minmax(420px,0.95fr)_minmax(420px,0.95fr)_minmax(0,1.55fr)] lg:px-8">
            <div className="h-[520px] animate-pulse rounded-lg border border-border-subtle bg-panel" />
            <div className="h-[520px] animate-pulse rounded-lg border border-border-subtle bg-panel" />
            <div className="h-[520px] animate-pulse rounded-lg border border-border-subtle bg-panel" />
          </div>
        ) : (
          <div className="grid gap-8 px-5 pt-20 lg:grid-cols-[minmax(420px,0.95fr)_minmax(420px,0.95fr)_minmax(0,1.55fr)] lg:px-8">
            <MoversList title="Top Winners" stocks={data.gainers ?? []} />
            <MoversList title="Top Losers" stocks={data.losers ?? []} />
            <NewsPanel articles={data.news ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
