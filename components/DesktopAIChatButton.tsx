"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockDetail } from "@/types/stock";
import { buildStockContextAsync, ColorizedText } from "@/components/mobile/StockAIChat";

interface Message { role: "user" | "model"; text: string; animating?: boolean }

function StreamingText({ text, onDone }: { text: string; onDone: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    const iv = setInterval(() => {
      setCount(c => {
        if (c >= text.length) { clearInterval(iv); onDone(); return c; }
        return c + 1;
      });
    }, 6);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return <ColorizedText text={text.slice(0, count)} />;
}

interface Props {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

export function DesktopAIChatButton({ stock, currentPrice, sentiment, metrics }: Props) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [stockContext, setStockContext] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Fetch full context (with graph data) when panel opens
  useEffect(() => {
    if (!open) return;
    buildStockContextAsync(stock, currentPrice, sentiment, metrics).then(setStockContext);
    setTimeout(() => inputRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  function handleClose() {
    setOpen(false);
    setMessages([]);
    setInput("");
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, text: m.text })),
          stockContext,
        }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setMessages(prev => [...prev, { role: "model", text: data.text ?? data.error ?? "No response.", animating: true }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Connection error." }]);
    } finally {
      setLoading(false);
    }
  }

  function markDone(i: number) {
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, animating: false } : m));
  }

  return (
    <>
      {/* The single AI button — next to the star */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ask AI about ${stock.symbol}`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-positive/40 bg-positive/10 text-positive transition-all duration-200 hover:bg-positive/20 hover:border-positive/70"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {/* Desktop modal — rendered in a portal-like fixed overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backdropFilter: "blur(6px) brightness(0.7)", WebkitBackdropFilter: "blur(6px) brightness(0.7)" }}
          onClick={handleClose}
        >
          {/* Modal panel */}
          <div
            className="relative flex flex-col bg-black border border-white/10 rounded-2xl shadow-2xl"
            style={{ width: "min(600px, 90vw)", height: "min(620px, 85vh)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-positive" />
                <span className="text-sm font-semibold text-positive">AI — {stock.symbol}</span>
              </div>
              <button
                onClick={handleClose}
                className="flex items-center justify-center h-7 w-7 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-4 min-h-0"
              style={{ overscrollBehavior: "contain" }}
            >
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-sm text-text-muted">
                  Ask me anything about {stock.symbol}
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[80%]",
                      msg.role === "user"
                        ? "bg-positive/75 text-black rounded-br-md font-medium"
                        : "bg-black/75 border border-white/10 text-white rounded-bl-md"
                    )}
                    style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}
                  >
                    {msg.role === "model" && msg.animating
                      ? <StreamingText text={msg.text} onDone={() => markDone(i)} />
                      : msg.role === "model"
                        ? <ColorizedText text={msg.text} />
                        : msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-black/75 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                    {[0,1,2].map(i => (
                      <span key={i} className="block h-1.5 w-1.5 rounded-full bg-positive"
                        style={{ animation: `aiDot 1.2s ${i*0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 py-3 border-t border-white/10">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2.5">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Ask about ${stock.symbol}…`}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full shrink-0 transition-all",
                    input.trim() && !loading ? "bg-positive text-black" : "bg-positive/20 text-positive/40 cursor-not-allowed"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </>
  );
}
