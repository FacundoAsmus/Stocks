"use client";

import { useState } from "react";

import { StockAIChat } from "@/components/mobile/StockAIChat";
import type { StockDetail } from "@/types/stock";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";

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
        <OptionalSvgIcon name="ai" className="ai-button-icon h-6 w-6" />
      </button>

      <StockAIChat
        stock={stock}
        currentPrice={currentPrice}
        sentiment={sentiment}
        metrics={metrics}
        externalOpen={chatOpen}
        onOpenChange={setChatOpen}
        hideTrigger
      />
    </>
  );
}
