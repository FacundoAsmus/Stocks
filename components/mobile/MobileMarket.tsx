"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { MarketFearGreed } from "@/components/market/MarketFearGreed";
import { EtfMobileList } from "@/components/market/EtfList";
import { formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketNewsArticle, StockSummary } from "@/types/stock";

const STORAGE_KEY = "market-lens-watchlist";
type MarketPayload = { tickerStocks?: StockSummary[]; gainers?: StockSummary[]; losers?: StockSummary[]; etfs?: StockSummary[]; news?: MarketNewsArticle[]; error?: string; };

function readWatchlist() {
  if (typeof window === "undefined") return [];
  try { const s = window.localStorage.getItem(STORAGE_KEY); return s ? (JSON.parse(s) as string[]) : []; }
  catch { return []; }
}

function MiniSparkline({ stock }: { stock: StockSummary }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const yesterdayClose = (stock.price ?? 0) - (stock.change ?? 0);
  const rawData = stock.sparkline?.length
    ? [{ close: yesterdayClose, time: 0 }, ...stock.sparkline]
    : [{ time: 0, close: yesterdayClose }, { time: 1, close: stock.price ?? 0 }];
  const data = rawData;
  return (
    <div className="h-8 w-16 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide width={0} />
          <Area type="monotone" dataKey="close" stroke={isPos ? "#00c805" : "#ff3003"}
            fill="transparent" strokeWidth={1.5} strokeLinecap="round" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MobileTicker({ stocks }: { stocks: StockSummary[] }) {
  if (!stocks.length) return null;
  const duped = [...stocks, ...stocks];
  return (
    <div
      className="sticky top-0 z-30"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      ref={(el) => { if (el) document.documentElement.style.setProperty("--ticker-height", el.offsetHeight + "px"); }}
    >
      {/* Fills this header's own box (including its safe-area-inset-top
          padding) with a blur that fades continuously from fully blurred
          at the very top to clear at the header's own bottom edge — sized
          automatically to this header via `absolute inset-0`, no
          per-page height guessing needed. A single layer with a pure
          gradient mask (no flat/non-fading portion), unlike EdgeBlur's
          HeaderTopBlur, which has a flat opaque segment before it starts
          fading and reads as a constant/non-gradient blur. */}
      <div
        className="absolute inset-x-0 top-0 -z-10 pointer-events-none"
        style={{
          height: "calc(100% + 6rem)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
      <div className="overflow-hidden">
        <div className="market-ticker flex w-max items-center" style={{ pointerEvents: "none" }}>
          {duped.map((s, i) => {
            const pos = (s.changePercent ?? 0) >= 0;
            return (
              <span key={`${s.symbol}-${i}`} className="flex items-center gap-2 border-r border-border-subtle/60 px-3 py-2">
                <span className="text-xs font-bold text-text-primary">{s.symbol}</span>
                <span className={cn("text-xs font-semibold", pos ? "text-positive" : "text-negative")}>{formatPercent(s.changePercent)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getMarketStatus(now: Date) {
  const utcH = now.getUTCHours(), utcM = now.getUTCMinutes(), dow = now.getUTCDay();
  const etMin = (((utcH - 5) % 24 + 24) % 24) * 60 + utcM;
  return { isOpen: dow >= 1 && dow <= 5 && etMin >= 570 && etMin < 960, label: (dow >= 1 && dow <= 5 && etMin >= 570 && etMin < 960) ? "Open" : "Closed" };
}

function MoverRow({ stock }: { stock: StockSummary }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <Link href={`/stock/${stock.symbol}`} className="flex items-center gap-3 px-4 py-4 border-b border-border-subtle/70 last:border-0 active:bg-panel-muted">
      {stock.logo
        ? <img src={stock.logo} alt="" className="h-8 w-8 rounded-md border border-white/10 bg-white/5 object-contain shrink-0" />
        : <span className="h-8 w-8 flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-xs font-bold text-text-primary shrink-0">{stock.symbol.slice(0, 2)}</span>
      }
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-text-primary truncate">{stock.symbol}</span>
        <span className="block text-xs text-text-muted truncate">{stock.name}</span>
      </span>
      <MiniSparkline stock={stock} />
      <span className={cn(
        "text-sm font-bold text-black shrink-0 px-3 py-1 rounded-lg min-w-[52px] text-center",
        isPos ? "bg-positive" : "bg-negative"
      )}>
        {formatPercent(stock.changePercent)}
      </span>
    </Link>
  );
}

function NewsRow({ article }: { article: MarketNewsArticle }) {
  return (
    <a href={article.url} target="_blank" rel="noreferrer" className="flex gap-3 rounded-xl bg-black p-3 active:opacity-80">
      {article.image
        ? <img src={article.image} alt="" className="h-[53px] w-[70px] rounded-md object-cover shrink-0 self-start" />
        : <span className="h-[53px] w-[70px] rounded-md bg-white/5 shrink-0" />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text-primary leading-snug line-clamp-2">{article.headline}</span>
        <span className="block mt-1 text-[10px] text-text-muted">{article.source} · {formatDateTime(article.datetime)}</span>
      </span>
    </a>
  );
}

type MoverTab = "etf" | "winners" | "losers";

function MoversSection({ gainers, losers, etfs }: { gainers: StockSummary[]; losers: StockSummary[]; etfs: StockSummary[] }) {
  const [tab, setTab] = useState<MoverTab>("etf");

  return (
    <div>
      <div className="flex px-4 gap-2 mb-3 overflow-x-auto no-scrollbar">
        {(["etf", "winners", "losers"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors shrink-0",
              tab === t ? "bg-positive text-black" : "text-positive"
            )}>
            {t === "etf" ? "ETF" : t === "winners" ? "Top Winners" : "Top Losers"}
          </button>
        ))}
      </div>

      {tab === "etf" && <EtfMobileList etfs={etfs} />}

      {tab !== "etf" && (
        <div className="mx-4 rounded-xl bg-black overflow-hidden">
          {(tab === "winners" ? gainers : losers).slice(0, 8).map((s) => (
            <MoverRow key={s.symbol} stock={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileMarket() {
  const [data, setData] = useState<MarketPayload>({});
  const [isLoading, setIsLoading] = useState(true);
  const [status] = useState(() => getMarketStatus(new Date()));

  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const wl = readWatchlist();
        const res = await fetch(`/api/market${wl.length ? `?watchlist=${wl.join(",")}` : ""}`, { signal: ctrl.signal });
        setData(await res.json() as MarketPayload);
      } catch { /* ignore abort */ }
      finally { if (!ctrl.signal.aborted) setIsLoading(false); }
    }
    load();
    return () => ctrl.abort();
  }, []);

  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const dayNum  = now.getDate();
  const suffix  = ["th","st","nd","rd"][dayNum % 10 > 3 || Math.floor(dayNum / 10) === 1 ? 0 : dayNum % 10] ?? "th";
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (isLoading) return <LoadingScreen label="Loading market data" />;

  return (
    <div className="relative pb-24 bg-black" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      <div className="relative">
        <MobileTicker stocks={data.tickerStocks ?? []} />

        {/* Welcome + status — sticky below the ticker bar */}
        <div className="sticky z-30 flex items-start justify-between px-4 pt-4 pb-3" style={{ top: "var(--ticker-height, 34px)" }}>
          <div>
            <h1 className="text-4xl font-bold text-text-primary">{dayName} {dayNum}{suffix}</h1>
            <p className="text-xs text-text-muted mt-0.5">{monthYear}</p>
          </div>
          <p className={cn("text-3xl font-bold pt-1", status.isOpen ? "text-positive" : "text-negative")}>{status.label}</p>
        </div>

        {/* Fear & Greed — spaced from welcome */}
        <div className="px-4 mt-8"><MarketFearGreed /></div>

        {/* Movers / ETF tabs — spaced from fear & greed */}
        <div className="mt-14"><MoversSection gainers={data.gainers ?? []} losers={data.losers ?? []} etfs={data.etfs ?? []} /></div>

        {/* News — always spaced below the list, never overlapping */}
        <div className="mt-8">
          <p className="px-4 text-xs font-semibold uppercase tracking-widest text-positive mb-3">News</p>
          <div className="mx-4 flex flex-col gap-3">
            {(data.news ?? []).slice(0, 10).map(a => <NewsRow key={a.id} article={a} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
