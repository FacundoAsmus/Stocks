"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Loader2, RotateCcw } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CandlePoint, ChartPeriod } from "@/types/stock";

const PERIODS: ChartPeriod[] = ["1M", "3M", "6M", "1Y", "ALL"];

function formatXAxisDate(dateStr: string, period: ChartPeriod): string {
  const date = new Date(dateStr);
  if (period === "ALL") return date.getFullYear().toString();
  if (period === "1Y") {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PriceChart({
  symbol,
  initialPeriod = "3M",
  heightClassName = "h-[360px]"
}: {
  symbol: string;
  initialPeriod?: ChartPeriod;
  heightClassName?: string;
}) {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod);
  const [data, setData] = useState<CandlePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCandles() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&period=${period}`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as { candles?: CandlePoint[]; error?: string };

        if (!response.ok) throw new Error(payload.error ?? "Unable to load chart data.");
        const candles = payload.candles ?? [];

        // Only append live price for non-ALL periods
        if (candles.length && period !== "ALL") {
          const today = new Date().toISOString().slice(0, 10);
          const lastCandle = candles[candles.length - 1];
          if (lastCandle.date !== today) {
            const liveResponse = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbol)}`, { signal: controller.signal });
            const liveData = (await liveResponse.json()) as { stocks?: { price: number }[] };
            const livePrice = liveData.stocks?.[0]?.price;
            if (livePrice) candles.push({ date: today, time: Date.now() / 1000, close: livePrice });
          }
        }

        setData(candles);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setData([]);
          setError(loadError instanceof Error ? loadError.message : "Unable to load chart data.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadCandles();
    return () => controller.abort();
  }, [period, reloadNonce, symbol]);

  const hasData = data.length > 1;
  const isPositive = useMemo(() => {
    if (!hasData) return true;
    return data[data.length - 1].close >= data[0].close;
  }, [data, hasData]);
  const lineColor = isPositive ? "#00c805" : "#ff3003";

  // For ALL, deduplicate so we only show one tick per year
  const tickFormatter = (val: string) => formatXAxisDate(val, period);
  const minTickGap = period === "ALL" ? 40 : period === "1Y" ? 32 : 24;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Price chart</h2>
          <p className="text-sm text-text-muted">
            {period === "ALL"
              ? "All-time monthly closes via Yahoo Finance."
              : "Historical closes with Finnhub first and a server-side fallback when candles are restricted."}
          </p>
        </div>
        <div className="flex w-full rounded-md border border-border-subtle bg-background p-1 sm:w-auto">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                option === "ALL" && "border-l border-border-subtle ml-1 pl-3",
                period === option
                  ? option === "ALL"
                    ? "bg-positive/15 text-positive"
                    : "bg-panel-muted text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className={heightClassName}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border-subtle text-sm text-text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Loading price history
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-negative/30 bg-negative/5 px-4 text-center">
            <p className="text-sm font-medium text-text-primary">Chart unavailable</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-text-muted">{error}</p>
            <button
              type="button"
              onClick={() => setReloadNonce((current) => current + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm text-text-primary transition hover:bg-panel-muted"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          </div>
        ) : hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={period === "ALL" ? 0.18 : 0} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#243244" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#93a4b8", fontSize: 12 }}
                tickLine={false}
                tickFormatter={tickFormatter}
                minTickGap={minTickGap}
              />
              <YAxis
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "#93a4b8", fontSize: 12 }}
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                tickLine={false}
                width={60}
              />
              <Tooltip
                animationDuration={150}
                contentStyle={{
                  background: "#0a0a0d",
                  border: "1px solid #1e1e24",
                  borderRadius: 8,
                  color: "#f3f7fb"
                }}
                formatter={(value) => [formatCurrency(Number(value)), "Close"]}
                labelFormatter={(label) => formatXAxisDate(label, period)}
                labelStyle={{ color: "#93a4b8" }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                fill={period === "ALL" ? "url(#chartFill)" : "transparent"}
                strokeWidth={period === "ALL" ? 2 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border-subtle px-4 text-center text-sm text-text-muted">
            Price history is not available for this symbol and period.
          </div>
        )}
      </div>
    </div>
  );
}

