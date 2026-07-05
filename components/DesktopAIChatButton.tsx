"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { StockAIChat } from "@/components/mobile/StockAIChat";
import type { StockDetail } from "@/types/stock";

interface Props {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

export function DesktopAIChatButton({ stock, currentPrice, sentiment, metrics }: Props) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        aria-label={`Ask AI about ${stock.symbol}`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-positive/40 bg-positive/10 text-positive transition-all duration-200 hover:-translate-y-1 hover:scale-[1.12]"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {chatOpen && (
        <StockAIChat
          stock={stock}
          currentPrice={currentPrice}
          sentiment={sentiment}
          metrics={metrics}
          onDismiss={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
