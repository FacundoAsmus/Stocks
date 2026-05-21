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

const PERIODS: ChartPeriod[] = ["1M", "3M", "6M", "1Y"];

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

        if (candles.length) {
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
  const lineColor = isPositive ? "#22c55e" : "#ef4444";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Price chart</h2>
          <p className="text-sm text-text-muted">
            Historical closes with Finnhub first and a server-side fallback when candles are restricted.
          </p>
        </div>
        <div className="grid w-full grid-cols-4 rounded-md border border-border-subtle bg-background p-1 sm:w-72">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition",
                period === option ? "bg-panel-muted text-text-primary" : "text-text-muted hover:text-text-primary"
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
                <linearGradient id={`detail-price-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#243244" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#93a4b8", fontSize: 12 }} tickLine={false} minTickGap={24} />
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
                labelStyle={{ color: "#93a4b8" }}
              />
              <Area
                dataKey="close"
                stroke={lineColor}
                fill={`url(#detail-price-${symbol.replace(/[^a-zA-Z0-9]/g, "")})`}
                strokeWidth={2}
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
