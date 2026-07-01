"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { CandleLoader, LoadingScreen } from "@/components/EmptyWatchlist";
import { ErrorState } from "@/components/ErrorState";
import { MarketFearGreed } from "@/components/market/MarketFearGreed";
import { EtfRow } from "@/components/market/EtfList";
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
    <div className="group grid min-h-[66px] grid-cols-[34px_minmax(76px,0.95fr)_minmax(104px,1.25fr)_minmax(92px,auto)_40px] items-center gap-3 rounded-md border border-transparent border-b-border-subtle/70 px-4 py-3 transition-all duration-200 hover:-translate-y-1 hover:border-positive/50 hover:bg-panel-muted/75 hover:shadow-2xl hover:shadow-black/25 hover:z-10 relative">
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
      <div className="rounded-lg border border-border-subtle bg-black p-2 shadow-2xl shadow-black/20 overflow-visible">
        {stocks.length ? (
          stocks.slice(0, 10).map((stock) => <MoverRow key={stock.symbol} stock={stock} />)
        ) : (
          <p className="py-8 text-sm text-text-muted">Market movers unavailable.</p>
        )}
      </div>
    </section>
  );
}


/* ─── Market status helpers ──────────────────────────────────────────────── */
// NYSE regular hours: Mon–Fri 09:30–16:00 ET (UTC-4 summer, UTC-5 winter)
// We approximate ET offset based on month (DST: Mar 2nd Sun → Nov 1st Sun).
function getETOffset(now: Date): number {
  const year = now.getUTCFullYear();
  // DST starts: 2nd Sunday of March
  const dstStart = new Date(Date.UTC(year, 2, 1));
  dstStart.setUTCDate(1 + (14 - dstStart.getUTCDay()) % 7);
  // DST ends:   1st Sunday of November
  const dstEnd = new Date(Date.UTC(year, 10, 1));
  dstEnd.setUTCDate(1 + (7 - dstEnd.getUTCDay()) % 7);
  return now >= dstStart && now < dstEnd ? -4 : -5; // hours offset from UTC
}

// NYSE holidays 2024-2026 (YYYY-MM-DD in ET)
const NYSE_HOLIDAYS = new Set([
  "2025-01-01","2025-01-20","2025-02-17","2025-04-18","2025-05-26",
  "2025-06-19","2025-07-04","2025-09-01","2025-11-27","2025-12-25",
  "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25",
  "2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
]);

function getMarketStatus(now: Date): {
  isOpen: boolean;
  label: string;
  subLabel: string;
} {
  const etOffset = getETOffset(now);
  const etMs = now.getTime() + etOffset * 3600_000;
  const et = new Date(etMs);

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${et.getUTCFullYear()}-${pad(et.getUTCMonth() + 1)}-${pad(et.getUTCDate())}`;
  const dow = et.getUTCDay(); // 0=Sun 6=Sat
  const hour = et.getUTCHours();
  const min  = et.getUTCMinutes();
  const timeMin = hour * 60 + min; // minutes since midnight ET

  const OPEN  = 9 * 60 + 30;  // 09:30
  const CLOSE = 16 * 60;      // 16:00

  const isHoliday = NYSE_HOLIDAYS.has(dateStr);
  const isWeekday = dow >= 1 && dow <= 5;
  const isDuringHours = timeMin >= OPEN && timeMin < CLOSE;

  const isOpen = isWeekday && !isHoliday && isDuringHours;

  if (isOpen) {
    const minsLeft = CLOSE - timeMin;
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return {
      isOpen: true,
      label: "Open",
      subLabel: h > 0
        ? `Closes in ${h}h ${m}m`
        : `Closes in ${m}m`,
    };
  }

  // Find next open day
  function nextOpen(from: Date): string {
    const check = new Date(from.getTime());
    for (let i = 1; i <= 10; i++) {
      check.setUTCDate(check.getUTCDate() + 1);
      const d = check.getUTCDay();
      const ds = `${check.getUTCFullYear()}-${pad(check.getUTCMonth()+1)}-${pad(check.getUTCDate())}`;
      if (d >= 1 && d <= 5 && !NYSE_HOLIDAYS.has(ds)) {
        return check.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
      }
    }
    return "soon";
  }

  // If today is a weekday but after close or before open
  if (isWeekday && !isHoliday) {
    if (timeMin < OPEN) {
      const minsUntil = OPEN - timeMin;
      const h = Math.floor(minsUntil / 60);
      const m = minsUntil % 60;
      return {
        isOpen: false,
        label: "Closed",
        subLabel: `Opens in ${h}h ${m}m · 9:30 AM ET`,
      };
    }
    // After close — find next day
    return {
      isOpen: false,
      label: "Closed",
      subLabel: `Opens ${nextOpen(et)}`,
    };
  }

  return {
    isOpen: false,
    label: isHoliday ? "Holiday" : "Closed",
    subLabel: `Opens ${nextOpen(et)}`,
  };
}

/* ─── Welcome hero banner ────────────────────────────────────────────────── */
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
        Welcome<br />
        {dayName} {dayNum}{suffix}
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
      <p className={cn(
        "text-4xl font-bold tracking-tight",
        status.isOpen ? "text-positive" : "text-negative"
      )}>
        {status.label}
      </p>
      <p className="mt-1 text-sm text-text-muted">{status.subLabel}</p>
    </div>
  );
}

function NewsPanel({ articles }: { articles: MarketNewsArticle[] }) {
  const items = articles.slice(0, 12);

  return (
    <section className="lg:sticky lg:top-[160px]">
      <h2 className="mb-3 text-lg font-semibold tracking-normal text-text-primary">News</h2>
      {!items.length ? (
        <div className="border-y border-border-subtle py-10 text-sm text-text-muted">Market news unavailable.</div>
      ) : (
        <div className="rounded-lg border border-border-subtle bg-panel divide-y divide-border-subtle/60">
          {items.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="flex gap-2.5 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-panel-muted hover:border-positive/50 hover:shadow-[0_0_12px_rgba(0,200,5,0.18)] relative z-0 hover:z-10 first:rounded-t-lg last:rounded-b-lg border border-transparent"
            >
              {article.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={article.image} alt="" className="h-10 w-14 rounded object-cover shrink-0 self-start mt-0.5" />
              ) : (
                <span className="h-10 w-14 rounded bg-panel-muted shrink-0 self-start mt-0.5" />
              )}
              <span className="min-w-0 flex flex-col justify-center">
                <span className="line-clamp-2 text-xs font-semibold leading-4 text-text-primary">{article.headline}</span>
                <span className="mt-1 text-[10px] text-text-muted">{article.source || "Market news"} · {formatDateTime(article.datetime)}</span>
              </span>
            </a>
          ))}
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
  const { sentimentColor } = useMemo(() => {
    const stocks = [...(data.gainers ?? []), ...(data.losers ?? [])];
    if (!stocks.length) return { sentimentColor: "transparent" };
    const greenCount = stocks.filter((stock) => (stock.changePercent ?? 0) > 0).length;
    const redCount   = stocks.filter((stock) => (stock.changePercent ?? 0) < 0).length;
    const color      = greenCount > redCount
      ? "rgba(0, 200, 5, 0.22)"
      : redCount > greenCount
        ? "rgba(255, 48, 3, 0.22)"
        : "rgba(250, 204, 21, 0.14)";
    return { sentimentColor: color };
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
    <div className="relative min-h-dvh">
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
          <LoadingScreen label="Loading market data" />
        ) : (
          <>
            {/* ── Full page: 70% left | 30% right ── */}
            <div className="grid gap-8 px-5 pt-12 pb-8 lg:grid-cols-[minmax(0,2.33fr)_minmax(0,1fr)] lg:px-8 lg:items-start">

              {/* LEFT 70%: welcome+status row → sentiment → ETF → movers */}
              <div className="flex flex-col gap-10">
                <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
                  <WelcomeHero />
                  <MarketStatusCard />
                </div>
                <MarketFearGreed />
                {/* ETF row — full width of the left column */}
                <section>
                  <h2 className="mb-3 text-2xl font-semibold tracking-normal text-text-primary">Sector ETFs</h2>
                  <EtfRow etfs={data.etfs ?? []} />
                </section>
                <div className="grid gap-8 lg:grid-cols-2">
                  <MoversList title="Top Winners" stocks={data.gainers ?? []} />
                  <MoversList title="Top Losers" stocks={data.losers ?? []} />
                </div>
              </div>

              {/* RIGHT 30%: news compact */}
              <NewsPanel articles={data.news ?? []} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
