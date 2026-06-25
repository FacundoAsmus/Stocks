"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { LoadingScreen } from "@/components/EmptyWatchlist";
import { MarketFearGreed } from "@/components/market/MarketFearGreed";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketNewsArticle, StockSummary } from "@/types/stock";

const STORAGE_KEY = "market-lens-watchlist";
type MarketPayload = { tickerStocks?: StockSummary[]; gainers?: StockSummary[]; losers?: StockSummary[]; news?: MarketNewsArticle[]; error?: string; };

function readWatchlist() {
  if (typeof window === "undefined") return [];
  try { const s = window.localStorage.getItem(STORAGE_KEY); return s ? (JSON.parse(s) as string[]) : []; }
  catch { return []; }
}

function MiniSparkline({ stock }: { stock: StockSummary }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  const data = stock.sparkline?.length ? stock.sparkline
    : [{ time: 0, close: (stock.price ?? 0) - (stock.change ?? 0) }, { time: 1, close: stock.price ?? 0 }];
  return (
    <div className="h-8 w-16 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
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
    <div className="sticky top-0 z-20 overflow-hidden border-b border-border-subtle/40 backdrop-blur-md">
      <div
        className="market-ticker flex w-max items-center"
        style={{ pointerEvents: "none" }}
      >
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
  );
}

function getMarketStatus(now: Date) {
  const utcH = now.getUTCHours(), utcM = now.getUTCMinutes(), dow = now.getUTCDay();
  const etMin = (((utcH - 5) % 24 + 24) % 24) * 60 + utcM;
  return { isOpen: dow >= 1 && dow <= 5 && etMin >= 570 && etMin < 960, label: (dow >= 1 && dow <= 5 && etMin >= 570 && etMin < 960) ? "Open" : "Closed" };
}

function MoverRow({ stock, rank }: { stock: StockSummary; rank: number }) {
  const isPos = (stock.changePercent ?? 0) >= 0;
  return (
    <Link href={`/stock/${stock.symbol}`} className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle/40 last:border-0 active:bg-panel-muted">
      <span className="text-xs text-text-muted w-4 shrink-0">{rank}</span>
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
    <a href={article.url} target="_blank" rel="noreferrer" className="flex gap-3 px-4 py-3 border-b border-border-subtle/40 last:border-0 active:bg-panel-muted">
      {article.image
        ? <img src={article.image} alt="" className="h-12 w-16 rounded-md object-cover shrink-0 self-start" />
        : <span className="h-12 w-16 rounded-md bg-panel-muted shrink-0" />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text-primary leading-snug line-clamp-2">{article.headline}</span>
        <span className="block mt-1 text-[10px] text-text-muted">{article.source} · {formatDateTime(article.datetime)}</span>
      </span>
    </a>
  );
}

function MoversSection({ gainers, losers }: { gainers: StockSummary[]; losers: StockSummary[] }) {
  const [tab, setTab] = useState<"winners" | "losers">("winners");
  const stocks = tab === "winners" ? gainers : losers;
  return (
    <div>
      <div className="flex px-4 gap-3 mb-3">
        {(["winners", "losers"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors",
              tab === t ? "bg-positive text-black" : "text-text-muted border border-border-subtle")}>
            {t === "winners" ? "Top Winners" : "Top Losers"}
          </button>
        ))}
      </div>
      <div className="mx-4 rounded-xl border border-border-subtle bg-panel overflow-hidden">
        {stocks.slice(0, 8).map((s, i) => <MoverRow key={s.symbol} stock={s} rank={i + 1} />)}
      </div>
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

  const { sentimentColor } = useMemo(() => {
    const stocks = [...(data.gainers ?? []), ...(data.losers ?? [])];
    if (!stocks.length) return { sentimentColor: "transparent" };
    const g = stocks.filter(s => (s.changePercent ?? 0) > 0).length;
    const r = stocks.filter(s => (s.changePercent ?? 0) < 0).length;
    return { sentimentColor: g > r ? "rgba(0,200,5,0.18)" : r > g ? "rgba(255,48,3,0.18)" : "rgba(250,204,21,0.12)" };
  }, [data.gainers, data.losers]);

  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const dayNum  = now.getDate();
  const suffix  = ["th","st","nd","rd"][dayNum % 10 > 3 || Math.floor(dayNum / 10) === 1 ? 0 : dayNum % 10] ?? "th";
  const monthYear = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (isLoading) return <LoadingScreen label="Loading market data" />;

  return (
    <div className="relative min-h-dvh pb-24">
      <div className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000"
        style={{ background: `linear-gradient(to top, ${sentimentColor} 0%, transparent 60%)` }} />
      <div className="relative z-10">
        <MobileTicker stocks={data.tickerStocks ?? []} />

        <div className="flex items-start justify-between px-4 pt-5 pb-1">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{dayName} {dayNum}{suffix}</h1>
            <p className="text-xs text-text-muted mt-0.5">{monthYear}</p>
          </div>
          <p className={cn("text-xl font-bold pt-1", status.isOpen ? "text-positive" : "text-negative")}>{status.label}</p>
        </div>

        <div className="px-4 mt-4"><MarketFearGreed /></div>
        <div className="mt-6"><MoversSection gainers={data.gainers ?? []} losers={data.losers ?? []} /></div>

        <div className="mt-6">
          <p className="px-4 text-xs font-semibold uppercase tracking-widest text-positive mb-3">News</p>
          <div className="mx-4 rounded-xl border border-border-subtle bg-panel overflow-hidden">
            {(data.news ?? []).slice(0, 10).map(a => <NewsRow key={a.id} article={a} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
