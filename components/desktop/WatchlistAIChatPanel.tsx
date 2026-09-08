"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";

import { buildStockContextAsync } from "@/components/mobile/StockAIChat";
import { cn } from "@/lib/utils";
import type { StockDetail } from "@/types/stock";

interface Message { role: "user" | "model"; text: string }

interface Props {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

// Desktop-only AI chat panel for the watchlist split view. Deliberately NOT
// reusing mobile/StockAIChat.tsx here: that component is built around
// full-viewport math (visual-viewport tracking, `calc(100vw - 2rem)`
// widths, a full-screen backdrop portaled to document.body) for the mobile
// experience. Bending that into "never occupy more than the right-hand 3/4
// column" would mean rewriting most of its positioning logic anyway, with
// real risk of regressing the mobile behavior it's tuned for.
//
// This panel instead renders inline (no portal) as an absolutely-positioned
// child of its own parent — the right-hand column in WatchlistSplitView,
// which is already `position: relative`. Its size is expressed as CSS
// percentages of that parent (`calc(100% - 3rem)`), not viewport units, so
// it's structurally impossible for it to spill into the list column,
// regardless of window size.
export function WatchlistAIChatPanel({ stock, currentPrice, sentiment, metrics }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stockContext, setStockContext] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the conversation and rebuild context whenever the selected stock
  // changes (the split view keeps this component mounted across selections).
  useEffect(() => {
    setMessages([]);
    setInput("");
    let cancelled = false;
    buildStockContextAsync(stock, currentPrice, sentiment, metrics).then(ctx => {
      if (!cancelled) setStockContext(ctx);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.symbol]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, text: m.text })), stockContext }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setMessages(prev => [...prev, { role: "model", text: data.text ?? data.error ?? "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const glassBg = "linear-gradient(155deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.35))";
  const glassShadow = "0 10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)";

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Ask AI about ${stock.symbol}`}
          className="pointer-events-auto absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full border border-white/25 text-positive overflow-hidden"
          style={{ background: glassBg, backdropFilter: "blur(22px) saturate(160%)", WebkitBackdropFilter: "blur(22px) saturate(160%)", boxShadow: glassShadow }}
        >
          <div
            aria-hidden
            className="absolute top-0 left-[18%] right-[18%] pointer-events-none"
            style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
          />
          <Sparkles className="h-6 w-6 relative" />
        </button>
      )}

      {/* Sized as a percentage of THIS column (the `absolute inset-0`
          wrapper above, itself a child of the relative right-hand column)
          — never the viewport — so it can't spill past the column. */}
      {open && (
        <div
          className="pointer-events-auto absolute bottom-6 right-6 flex flex-col overflow-hidden rounded-2xl border border-white/25"
          style={{
            width: "min(420px, calc(100% - 3rem))",
            height: "min(640px, calc(100% - 3rem))",
            background: "linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.6))",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-positive" />
              Ask about {stock.symbol}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-text-muted">
                Ask anything about {stock.symbol} — price action, fundamentals, news, or analyst sentiment.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user" ? "self-end bg-positive text-black" : "self-start border border-positive/40 text-text-primary"
                )}
              >
                {m.text}
              </div>
            ))}
            {loading && <div className="self-start text-sm text-text-muted">Thinking…</div>}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
              placeholder="Ask a question…"
              className="flex-1 rounded-lg bg-panel-muted px-3 py-2 text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-positive text-black disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
