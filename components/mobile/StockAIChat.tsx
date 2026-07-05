"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockDetail } from "@/types/stock";

interface Message { role: "user" | "model"; text: string }

function buildStockContext(
  stock: StockDetail,
  currentPrice: number,
  sentiment: { score: number; drivers: string[] },
  metrics: Record<string, number | string | null> | undefined
): string {
  const lines: string[] = [
    `Stock: ${stock.profile.name ?? stock.symbol} (${stock.symbol})`,
    `Exchange: ${stock.profile.exchange ?? "N/A"}`,
    `Industry: ${stock.profile.finnhubIndustry ?? "N/A"}`,
    `Current Price: $${currentPrice.toFixed(2)}`,
    `Day Change: ${stock.quote.dp?.toFixed(2) ?? "N/A"}%`,
    `Previous Close: $${stock.quote.pc?.toFixed(2) ?? "N/A"}`,
    `52W High: $${stock.quote.h?.toFixed(2) ?? "N/A"} | 52W Low: $${stock.quote.l?.toFixed(2) ?? "N/A"}`,
    `Sentiment Score: ${sentiment.score}/100 (${sentiment.drivers.join(", ")})`,
  ];
  if (metrics) {
    const ml = Object.entries(metrics).filter(([,v]) => v !== null).map(([k,v]) => `${k}: ${v}`);
    if (ml.length) lines.push(`Fundamentals: ${ml.join(" | ")}`);
  }
  const a = stock.recommendations?.[0];
  if (a) lines.push(`Analyst: Strong Buy ${a.strongBuy} | Buy ${a.buy} | Hold ${a.hold} | Sell ${a.sell} | Strong Sell ${a.strongSell}`);
  if (stock.priceTarget?.targetMean) lines.push(`Avg Price Target: $${stock.priceTarget.targetMean.toFixed(2)}`);
  if (stock.news?.length) {
    const h = stock.news.slice(0, 5).map(n => `• ${n.headline} (${n.source}) — ${n.url}`).join("\n");
    lines.push(`Recent News:\n${h}`);
  }
  return lines.join("\n");
}

interface Props {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
  onDismiss: () => void;
}

export function StockAIChat({ stock, currentPrice, sentiment, metrics, onDismiss }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [visible, setVisible]   = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const stockContext = buildStockContext(stock, currentPrice, sentiment, metrics);

  // Track iOS visual viewport so the panel stays truly pinned to the bottom
  // of the visible screen — without this, the panel can drift/get cut off
  // when the on-screen keyboard opens or Safari's chrome shows/hides.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardInset(inset > 0 ? inset : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Lock page scroll WITHOUT jumping to top — save & restore scroll position
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;

    // Prevent scroll but keep the page visually in place
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top      = `-${scrollY}px`;
    body.style.left     = "0";
    body.style.right    = "0";

    requestAnimationFrame(() => {
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 340);
    });

    return () => {
      // Restore scroll position exactly
      body.style.overflow = "";
      body.style.position = "";
      body.style.top      = "";
      body.style.left     = "";
      body.style.right    = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Scroll messages to bottom on update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 280);
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
        body: JSON.stringify({ messages: newMessages, stockContext }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setMessages(prev => [...prev, { role: "model", text: data.text ?? data.error ?? "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // Backdrop touch: quick tap = dismiss, hold/move = ignore (let chat scroll)
  function onBdTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  }
  function onBdTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    const dt = Date.now() - touchStart.current.time;
    if (dx < 8 && dy < 8 && dt < 300) handleDismiss();
    touchStart.current = null;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, pointerEvents: "auto" }}>
      {/* Frosted backdrop — covers full screen, tap dismisses */}
      <div
        style={{
          position: "absolute", inset: 0,
          backdropFilter:       visible ? "blur(8px) brightness(0.7)" : "none",
          WebkitBackdropFilter: visible ? "blur(8px) brightness(0.7)" : "none",
          transition: "backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease",
        }}
        onTouchStart={onBdTouchStart}
        onTouchEnd={onBdTouchEnd}
        onClick={handleDismiss}
      />

      {/* Chat panel — pinned to the true bottom of the visible screen (above any
          keyboard), reaching almost to the top so messages have room to grow
          without being cut off mid-screen */}
      <div
        style={{
          position: "fixed",
          left: 0, right: 0,
          top: "max(3rem, calc(env(safe-area-inset-top) + 1rem))",
          bottom: keyboardInset,
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.2,0,0,1), bottom 0.15s ease",
          zIndex: 1000,
        }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {/* Messages — scrollable area, grows upward */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 pt-4 pb-2 min-h-0"
          style={{ overscrollBehavior: "contain" }}
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs" style={{ color: "#00c805aa" }}>
              <Sparkles className="h-3.5 w-3.5" />
              Ask me anything about {stock.symbol}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  msg.role === "user" ? "bg-positive text-black" : "bg-black/95 border border-white/10 text-text-primary"
                )}
                style={{
                  maxWidth: "85%",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  padding: "10px 16px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  fontSize: "14px",
                  lineHeight: "1.5",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="bg-black/95 border border-white/10"
                style={{
                  padding: "12px 16px",
                  borderRadius: "18px 18px 18px 4px",
                  display: "flex", gap: "6px", alignItems: "center"
                }}
              >
                {[0,1,2].map(i => (
                  <span key={i} className="bg-positive" style={{
                    display: "block", height: 6, width: 6,
                    borderRadius: "50%",
                    animation: `aiDot 1.2s ${i * 0.2}s ease-in-out infinite`
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input bar — always at bottom of panel */}
        <div
          className="shrink-0 px-3 pt-2"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div
            className="bg-black border border-white/20"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              borderRadius: 999,
              padding: "10px 12px 10px 18px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Ask about ${stock.symbol}…`}
              className="text-text-primary placeholder:text-text-muted"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 14,
                caretColor: "#00c805",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                flexShrink: 0,
                height: 34, width: 34,
                borderRadius: "50%",
                backgroundColor: input.trim() && !loading ? "#00c805" : "rgba(0,200,5,0.2)",
                color: input.trim() && !loading ? "#000" : "rgba(0,200,5,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                transition: "background-color 0.2s, color 0.2s",
              }}
            >
              <Send style={{ height: 14, width: 14 }} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
