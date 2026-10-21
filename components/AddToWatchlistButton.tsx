"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

const STORAGE_KEY = "market-lens-watchlist";

function getStoredSymbols() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function setStoredSymbols(symbols: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
}

export function AddToWatchlistButton({
  symbol,
  name,
  compact = false,
  hoverRemoveIcon = false,
}: {
  symbol: string;
  name: string;
  compact?: boolean;
  hoverRemoveIcon?: boolean;
}) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    function syncSavedState() {
      setIsSaved(getStoredSymbols().includes(symbol));
    }

    syncSavedState();
    window.addEventListener("watchlist-updated", syncSavedState);
    window.addEventListener("storage", syncSavedState);
    return () => {
      window.removeEventListener("watchlist-updated", syncSavedState);
      window.removeEventListener("storage", syncSavedState);
    };
  }, [symbol]);

  function toggleWatchlist() {
    const current = getStoredSymbols();
    const next = current.includes(symbol)
      ? current.filter((item) => item !== symbol)
      : [...current, symbol].slice(0, 30);

    setStoredSymbols(next);
    setIsSaved(next.includes(symbol));
    // Dispatch event so other components (MobileWatchlist, AppNav stars) stay in sync
    window.dispatchEvent(new Event("watchlist-updated"));
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={isSaved ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
        onClick={toggleWatchlist}
        className={cn(
          "group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-accent transition-all duration-200 hover:-translate-y-1 hover:scale-[1.12] hover:bg-white/5"
        )}
      >
        <OptionalSvgIcon name="star" selected={isSaved} fallbackToBaseWhenSelected className="h-6 w-6" />
        {isSaved && hoverRemoveIcon && (
          <OptionalSvgIcon name="star-crossed" className="pointer-events-none absolute h-6 w-6 opacity-0 transition-opacity lg:group-hover:opacity-100" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleWatchlist}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition",
        isSaved
          ? "border-negative/40 bg-negative/10 text-negative hover:bg-negative/15"
          : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
      )}
    >
      {isSaved ? <Trash2 className="h-4 w-4" /> : <OptionalSvgIcon name="star" className="h-4 w-4" />}
      {isSaved ? "Remove" : "Add to watchlist"}
    </button>
  );
}
