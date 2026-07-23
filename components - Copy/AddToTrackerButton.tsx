"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { addHolding } from "@/lib/tracker";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  companyName: string;
  currentPrice?: number;
}

export function AddToTrackerButton({ symbol, companyName }: Props) {
  const [open, setOpen]               = useState(false);
  const [quantity, setQuantity]       = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitted, setSubmitted]     = useState(false);
  const [fetching, setFetching]       = useState(false);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const abortRef                       = useRef<AbortController | null>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function handleOpen() {
    setQuantity("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setSubmitted(false);
    setFetchError(null);
    setOpen(true);
  }

  function handleClose() {
    abortRef.current?.abort();
    setOpen(false);
  }

  async function handleAdd() {
    const qty = parseFloat(quantity);
    if (!qty || !purchaseDate) return;

    setFetching(true);
    setFetchError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Fetch 1M candles and find the closest price to purchaseDate
      const res = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&period=1Y`,
        { signal: ctrl.signal }
      );
      const json = await res.json() as { candles?: { time: number; close: number; date: string }[] };
      const candles = json.candles ?? [];

      // Find the candle closest to the selected purchase date
      const targetTs = new Date(purchaseDate).getTime() / 1000;
      let best = candles[0];
      let bestDiff = Infinity;
      for (const c of candles) {
        const diff = Math.abs(c.time - targetTs);
        if (diff < bestDiff) { bestDiff = diff; best = c; }
      }

      const historicalPrice = best?.close ?? 0;
      if (!historicalPrice) throw new Error("No price found for that date");

      addHolding({
        ticker: symbol,
        companyName,
        quantity: qty,
        purchasePrice: historicalPrice,
        purchaseDate,
      });
      setSubmitted(true);
      setTimeout(() => setOpen(false), 900);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setFetchError("Could not fetch historical price. Try a different date.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-center h-11 w-11 rounded-full border border-positive/60 bg-transparent text-positive text-2xl leading-none transition hover:bg-positive/10 active:scale-90"
        aria-label="Add to Tracker"
        title="Add to Tracker"
      >
        +
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", background: "rgba(0,0,0,0.72)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="w-full rounded-2xl border border-border-subtle bg-black p-6 shadow-2xl"
            style={{
              maxWidth: "min(420px, calc(100vw - 2rem))",
              animation: "fadeInScale 0.18s ease both",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header — matches app Back button style */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleClose}
                className="flex items-center gap-1 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-positive">Add to Tracker</p>
                <h2 className="text-lg font-bold text-text-primary">{symbol}</h2>
              </div>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="text-3xl">✓</span>
                <p className="text-positive font-semibold">Added to Tracker</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Number of Shares */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Number of Shares
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="0"
                    className="rounded-lg border border-border-subtle bg-panel px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted/50"
                  />
                </div>

                {/* Purchase Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => { setPurchaseDate(e.target.value); setFetchError(null); }}
                    className="rounded-lg border border-border-subtle bg-panel px-3 py-2.5 text-sm text-text-primary outline-none [color-scheme:dark]"
                  />
                  <p className="text-xs text-text-muted">
                    Purchase price will be auto-fetched from market data for this date.
                  </p>
                </div>

                {fetchError && (
                  <p className="text-xs text-negative">{fetchError}</p>
                )}

                <button
                  onClick={handleAdd}
                  disabled={!quantity || !purchaseDate || fetching}
                  className={cn(
                    "mt-2 w-full rounded-lg py-3 text-sm font-semibold transition",
                    quantity && purchaseDate && !fetching
                      ? "bg-positive text-black hover:bg-positive/90"
                      : "bg-positive/20 text-positive/40 cursor-not-allowed"
                  )}
                >
                  {fetching ? "Fetching price…" : "Add to Tracker"}
                </button>
              </div>
            )}
          </div>
          <style>{`
            @keyframes fadeInScale {
              from { opacity: 0; transform: scale(0.96) translateY(6px); }
              to   { opacity: 1; transform: scale(1)    translateY(0);   }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  );
}
