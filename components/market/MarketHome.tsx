"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { ErrorState } from "@/components/ErrorState";
import { MarketFearGreed } from "@/components/market/MarketFearGreed";
import { StockCard } from "@/components/StockCard";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketNewsArticle, StockSummary } from "@/types/stock";

const STORAGE_KEY = "market-lens-watchlist";

type MarketPayload = {
  tickerStocks?: StockSummary[];
  gainers?: StockSummary[];
  losers?: StockSummary[];
  etfs?: StockSummary[];
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

// ─── Ticker bar ───────────────────────────────────────────────────────────
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
          <YAxis domain={["dataMin", "dataMax"]} hide width={0} />
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
    <section className="sticky top-[97px] z-30 overflow-hidden border-y border-border-subtle bg-black">
      <div className="market-ticker flex w-max items-stretch">
        {tickerStocks.map((stock, index) => {
          const isPositive = (stock.changePercent ?? 0) >= 0;
          return (
            <Link
              key={`${stock.symbol}-${index}`}
              href={`/stock/${encodeURIComponent(stock.symbol)}`}
              className="flex min-w-[282px] items-center gap-4 border-x border-border-subtle/80 px-4 py-3 transition-colors duration-300 hover:border-positive/60 hover:bg-panel-muted/80"
            >
              <span className="min-w-[78px]">
                <span className="block truncate text-sm font-bold text-text-primary">{stock.symbol}</span>
                <span className={cn("block truncate text-xs font-semibold", isPositive ? "text-positive" : "text-negative")}>
                  {formatPercent(stock.changePercent)}
                </span>
              </span>
              <MiniSparkline stock={stock} />
              <span className={cn(
                "min-w-[92px] rounded-md border px-3 py-2 text-center text-sm font-bold text-black",
                isPositive
                  ? "border-positive/50 bg-positive !text-black"
                  : "border-negative/70 bg-negative !text-black"
              )}>
                {formatCurrency(stock.price)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Market status + welcome ───────────────────────────────────────────────
function getETOffset(now: Date): number {
  const year = now.getUTCFullYear();
  const dstStart = new Date(Date.UTC(year, 2, 1));
  dstStart.setUTCDate(1 + (14 - dstStart.getUTCDay()) % 7);
  const dstEnd = new Date(Date.UTC(year, 10, 1));
  dstEnd.setUTCDate(1 + (7 - dstEnd.getUTCDay()) % 7);
  return now >= dstStart && now < dstEnd ? -4 : -5;
}

const NYSE_HOLIDAYS = new Set([
  "2025-01-01","2025-01-20","2025-02-17","2025-04-18","2025-05-26",
  "2025-06-19","2025-07-04","2025-09-01","2025-11-27","2025-12-25",
  "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25",
  "2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
]);

function getMarketStatus(now: Date) {
  const etOffset = getETOffset(now);
  const et = new Date(now.getTime() + etOffset * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${et.getUTCFullYear()}-${pad(et.getUTCMonth() + 1)}-${pad(et.getUTCDate())}`;
  const dow = et.getUTCDay();
  const timeMin = et.getUTCHours() * 60 + et.getUTCMinutes();
  const OPEN = 9 * 60 + 30;
  const CLOSE = 16 * 60;
  const isHoliday = NYSE_HOLIDAYS.has(dateStr);
  const isWeekday = dow >= 1 && dow <= 5;
  const isOpen = isWeekday && !isHoliday && timeMin >= OPEN && timeMin < CLOSE;

  function nextOpen(from: Date): string {
    const check = new Date(from.getTime());
    for (let i = 1; i <= 10; i++) {
      check.setUTCDate(check.getUTCDate() + 1);
      const d = check.getUTCDay();
      const ds = `${check.getUTCFullYear()}-${pad(check.getUTCMonth()+1)}-${pad(check.getUTCDate())}`;
      if (d >= 1 && d <= 5 && !NYSE_HOLIDAYS.has(ds))
        return check.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
    }
    return "soon";
  }

  if (isOpen) {
    const minsLeft = CLOSE - timeMin;
    const h = Math.floor(minsLeft / 60), m = minsLeft % 60;
    return { isOpen: true, label: "Open", subLabel: h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m` };
  }
  if (isWeekday && !isHoliday && timeMin < OPEN) {
    const minsUntil = OPEN - timeMin;
    const h = Math.floor(minsUntil / 60), m = minsUntil % 60;
    return { isOpen: false, label: "Closed", subLabel: `Opens in ${h}h ${m}m · 9:30 AM ET` };
  }
  return { isOpen: false, label: isHoliday ? "Holiday" : "Closed", subLabel: `Opens ${nextOpen(et)}` };
}

function WelcomeHero() {
  const now = new Date();
  const dayName   = now.toLocaleDateString("en-US", { weekday: "long" });
  const dayNum    = now.getDate();
  const monthName = now.toLocaleDateString("en-US", { month: "long" });
  const year      = now.getFullYear();
  const suffix = ["th","st","nd","rd"][dayNum % 10 > 3 || Math.floor(dayNum / 10) === 1 ? 0 : dayNum % 10] ?? "th";
  return (
    <div className="pb-2">
      <h1 className="text-4xl font-bold tracking-tight text-text-primary leading-tight">
        Welcome<br />{dayName} {dayNum}{suffix}
      </h1>
      <p className="mt-1 text-base text-text-muted">{monthName} {year}</p>
    </div>
  );
}

function MarketStatusCard() {
  const [status, setStatus] = useState(() => getMarketStatus(new Date()));
  useEffect(() => {
    const id = setInterval(() => setStatus(getMarketStatus(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col justify-center items-end text-right pt-6">
      <p className={cn("text-4xl font-bold tracking-tight", status.isOpen ? "text-positive" : "text-negative")}>
        {status.label}
      </p>
      <p className="mt-1 text-sm text-text-muted">{status.subLabel}</p>
    </div>
  );
}

// ─── News section ─────────────────────────────────────────────────────────
function NewsSection({ articles }: { articles: MarketNewsArticle[] }) {
  const [hero, ...rest] = articles.slice(0, 9);

  if (!articles.length) return (
    <section>
      <h2 className="mb-4 text-2xl font-semibold text-text-primary">Market News</h2>
      <div className="border-y border-border-subtle py-10 text-sm text-text-muted">Market news unavailable.</div>
    </section>
  );

  return (
    <section>
      <h2 className="mb-6 text-2xl font-semibold text-text-primary">Market News</h2>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Hero article — big image, takes full height on the left */}
        {hero && (
          <a
            href={hero.url}
            target="_blank"
            rel="noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-[#3a3a42] bg-black transition-all duration-300 hover:border-positive/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:-translate-y-1 lg:row-span-2"
          >
            {hero.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.image}
                alt=""
                className="h-72 w-full object-cover lg:h-96"
              />
            ) : (
              <div className="h-72 w-full bg-panel-muted lg:h-96" />
            )}
            <div className="p-5">
              <p className="text-xs text-text-muted mb-2">
                {hero.source || "Market news"} · {formatDateTime(hero.datetime)}
              </p>
              <h3 className="text-xl font-bold leading-7 text-text-primary group-hover:text-positive transition-colors">
                {hero.headline}
              </h3>
              {hero.summary && (
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">{hero.summary}</p>
              )}
            </div>
          </a>
        )}

        {/* Remaining articles — smaller cards in a 1-col grid on the right */}
        <div className="flex flex-col gap-4">
          {rest.slice(0, 4).map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-4 overflow-hidden rounded-xl border border-[#3a3a42] bg-black p-4 transition-all duration-200 hover:border-positive/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              {article.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.image}
                  alt=""
                  className="h-20 w-28 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="h-20 w-28 rounded-lg bg-panel-muted shrink-0" />
              )}
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-xs text-text-muted mb-1.5">
                  {article.source || "Market news"} · {formatDateTime(article.datetime)}
                </p>
                <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-text-primary group-hover:text-positive transition-colors">
                  {article.headline}
                </h3>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Bottom row — remaining articles in a 3-col grid */}
      {rest.length > 4 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.slice(4).map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-3 overflow-hidden rounded-xl border border-[#3a3a42] bg-black p-3 transition-all duration-200 hover:border-positive/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              {article.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.image}
                  alt=""
                  className="h-14 w-20 rounded-md object-cover shrink-0"
                />
              ) : (
                <div className="h-14 w-20 rounded-md bg-panel-muted shrink-0" />
              )}
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-[10px] text-text-muted mb-1">{article.source || "Market news"}</p>
                <h3 className="line-clamp-2 text-xs font-semibold leading-4 text-text-primary group-hover:text-positive transition-colors">
                  {article.headline}
                </h3>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Root component ────────────────────────────────────────────────────────
export function MarketHome() {
  const [data, setData] = useState<MarketPayload>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialWatchlist] = useState<string[]>(() => readWatchlist());
  const watchlistQuery = useMemo(() => initialWatchlist.join(","), [initialWatchlist]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadMarket() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/market?watchlist=${encodeURIComponent(watchlistQuery)}`, { signal: controller.signal });
        const payload = (await response.json()) as MarketPayload;
        if (!response.ok) throw new Error(payload.error ?? "Unable to load market data.");
        setData(payload);
      } catch (loadError) {
        if (!controller.signal.aborted)
          setError(loadError instanceof Error ? loadError.message : "Unable to load market data.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    loadMarket();
    return () => controller.abort();
  }, [watchlistQuery]);

  if (error) return <ErrorState title="Market unavailable" message={error} />;
  if (isLoading) return <LoadingScreen label="Loading market data" />;

  return (
    <div className="min-h-dvh bg-black">
      <TickerBar stocks={data.tickerStocks ?? []} />

      <div className="px-5 pt-12 pb-16 lg:px-8 flex flex-col gap-12">

        {/* Welcome + market status */}
        <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
          <WelcomeHero />
          <MarketStatusCard />
        </div>

        {/* Fear & Greed */}
        <MarketFearGreed />

        {/* Three columns: ETFs | Top Winners | Top Losers
            Cards are identical to the watchlist page — same grid, same min-h.
            Titles are sticky, cards scroll behind them.
            Vertical dividers sit between columns, inset from top and bottom. */}
        <section>
          <div className="relative grid lg:grid-cols-3" style={{ alignItems: "start" }}>

            {/* Dividers — positioned after the grid so they don't affect column width */}
            <div className="hidden lg:block absolute top-8 bottom-8 w-px bg-[#3a3a42]" style={{ left: "calc(33.333% - 0.5px)" }} />
            <div className="hidden lg:block absolute top-8 bottom-8 w-px bg-[#3a3a42]" style={{ left: "calc(66.666% - 0.5px)" }} />

            {(["etfs", "gainers", "losers"] as const).map((key, colIdx) => {
              const titles = { etfs: "Sector ETFs", gainers: "Top Winners", losers: "Top Losers" };
              const stocks = (key === "etfs" ? data.etfs : key === "gainers" ? data.gainers : data.losers) ?? [];
              const isFirst = colIdx === 0;
              const isLast  = colIdx === 2;
              return (
                <div key={key} className="flex flex-col min-w-0" style={{
                  paddingLeft:  isFirst ? 0 : "2rem",
                  paddingRight: isLast  ? 0 : "2rem",
                }}>
                  {/* Sticky title — stays visible while scrolling the list */}
                  <div className="sticky z-20 bg-black pb-3 pt-1" style={{ top: "160px" }}>
                    <h2 className="text-xl font-semibold text-text-primary">{titles[key]}</h2>
                  </div>
                  {/* Cards — same grid class as watchlist */}
                  <div className="grid grid-cols-1 gap-3 sm:gap-6 auto-rows-fr items-stretch w-full">
                    {stocks.slice(0, 10).map((stock) => (
                      <StockCard key={stock.symbol} stock={stock} />
                    ))}
                  </div>
                </div>
              );
            })}

          </div>
        </section>

        {/* News — full width, bottom of page */}
        <NewsSection articles={data.news ?? []} />
      </div>
    </div>
  );
}
