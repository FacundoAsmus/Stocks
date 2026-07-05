"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Send, Sparkles } from "lucide-react";
import type { StockDetail } from "@/types/stock";

interface Message { role: "user" | "model"; text: string; animating?: boolean }

// Split AI text on [[+]]positive[[/+]] and [[-]]negative[[/-]] tags and render coloured spans
function ColorizedText({ text }: { text: string }) {
  const parts: { str: string; type: "neutral" | "pos" | "neg" }[] = [];
  const regex = /(\[\[\+\]\])(.*?)(\[\[\/\+\]\])|(\[\[-\]\])(.*?)(\[\[\/-\]\])/gs;
  let last = 0, m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ str: text.slice(last, m.index), type: "neutral" });
    if (m[1]) parts.push({ str: m[2], type: "pos" });
    else       parts.push({ str: m[5], type: "neg" });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ str: text.slice(last), type: "neutral" });
  return (
    <>
      {parts.map((p, i) =>
        p.type === "pos" ? (
          <span key={i} style={{ color: "#00c805", fontWeight: 600 }}>{p.str}</span>
        ) : p.type === "neg" ? (
          <span key={i} style={{ color: "#ff3003", fontWeight: 600 }}>{p.str}</span>
        ) : (
          <span key={i}>{p.str}</span>
        )
      )}
    </>
  );
}

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
    const ml = Object.entries(metrics).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`);
    if (ml.length) lines.push(`Fundamentals: ${ml.join(" | ")}`);
  }
  const a = stock.recommendations?.[0];
  if (a) lines.push(`Analyst: Strong Buy ${a.strongBuy} | Buy ${a.buy} | Hold ${a.hold} | Sell ${a.sell} | Strong Sell ${a.strongSell}`);
  if (stock.priceTarget?.targetMean) lines.push(`Avg Price Target: $${stock.priceTarget.targetMean.toFixed(2)}`);
  if (stock.news?.length) {
    const h = stock.news.slice(0, 5).map(n => `• ${n.headline} (${n.source})`).join("\n");
    lines.push(`Recent News:\n${h}`);
  }
  return lines.join("\n");
}

// Streams AI text character by character with a green glow on the last char
function AnimatedText({ text, onDone }: { text: string; onDone: () => void }) {
  const [count, setCount] = useState(0);
  const isDone = count >= text.length;

  useEffect(() => {
    setCount(0);
    const iv = setInterval(() => {
      setCount(c => {
        if (c >= text.length) { clearInterval(iv); onDone(); return c; }
        return c + 1;
      });
    }, 13);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Slice at count but avoid cutting inside a tag so we don't show partial markup
  // We advance past any incomplete tag at the cut point
  const slice = text.slice(0, count);

  return (
    <>
      <ColorizedText text={slice} />
      {!isDone && (
        <span style={{
          display: "inline-block",
          width: "2px",
          height: "1em",
          marginLeft: "2px",
          verticalAlign: "text-bottom",
          backgroundColor: "#00c805",
          borderRadius: "1px",
          boxShadow: "0 0 6px 2px rgba(0,200,5,0.7)",
          animation: "aiCursor 0.7s ease-in-out infinite",
        }} />
      )}
    </>
  );
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
  const [vp, setVp] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const scrollRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const stockContext = buildStockContext(stock, currentPrice, sentiment, metrics);

  // Track visual viewport (handles iOS keyboard shrinking the screen)
  useEffect(() => {
    function update() {
      const vv = window.visualViewport;
      setVp(vv
        ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
      );
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Lock body scroll without jumping to top
  useEffect(() => {
    const scrollY = window.scrollY;
    const b = document.body;
    b.style.overflow = "hidden";
    b.style.position = "fixed";
    b.style.top      = `-${scrollY}px`;
    b.style.left     = "0";
    b.style.right    = "0";
    requestAnimationFrame(() => {
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 320);
    });
    return () => {
      b.style.overflow = b.style.position = b.style.top = b.style.left = b.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 260);
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
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, text: m.text })), stockContext }),
      });
      const data = await res.json() as { text?: string; error?: string };
      setMessages(prev => [...prev, { role: "model", text: data.text ?? data.error ?? "No response.", animating: true }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function markDone(i: number) {
    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, animating: false } : m));
  }

  const isLightMode = typeof document !== "undefined" && document.documentElement.classList.contains("light-mode");

  // Colors that respect light/dark mode
  const bgPanel   = isLightMode ? "rgba(255,255,255,0.98)"  : "rgba(10,10,14,0.98)";
  const bgBubbleAI = isLightMode ? "rgba(240,240,245,1)"    : "rgba(22,22,28,1)";
  const bubbleBorder = isLightMode ? "rgba(0,0,0,0.10)"     : "rgba(255,255,255,0.10)";
  const inputBg   = isLightMode ? "rgba(235,235,240,1)"     : "rgba(28,28,34,1)";
  const inputBorder = isLightMode ? "rgba(0,0,0,0.15)"      : "rgba(255,255,255,0.15)";
  const textColor = isLightMode ? "#1a1a1e"                  : "#f0f0f2";
  const placeholderStyle = isLightMode ? "#999" : "#555";

  const vpW = vp.width  || window.innerWidth;
  const vpH = vp.height || window.innerHeight;

  return (
    <div style={{
      // Pinned to the EXACT visual viewport rectangle — no drift on iOS Safari
      position: "fixed",
      top: vp.top,
      left: vp.left,
      width: vpW,
      height: vpH,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      pointerEvents: "auto",
    }}>
      {/* Frosted backdrop */}
      <div
        style={{
          position: "absolute", inset: 0,
          backdropFilter:       visible ? "blur(8px) brightness(0.65)" : "none",
          WebkitBackdropFilter: visible ? "blur(8px) brightness(0.65)" : "none",
          transition: "backdrop-filter 0.25s ease, -webkit-backdrop-filter 0.25s ease",
        }}
        onClick={handleDismiss}
      />

      {/* ── Chat panel — full viewport height, transparent so blurred page shows through ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.30s cubic-bezier(0.2,0,0,1)",
          zIndex: 10000,
          // NO backgroundColor here — the backdrop blur handles the visual
        }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {/* ── Messages — flex-1 so they push down to the controls ── */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 12,
            padding: "16px 14px 8px",
            minHeight: 0,
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#00c80580", fontSize: 15 }}>
              Ask me anything about {stock.symbol}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "86%",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
                padding: "12px 18px",
                borderRadius: msg.role === "user" ? "20px 20px 5px 20px" : "20px 20px 20px 5px",
                backgroundColor: msg.role === "user" ? "#00c805" : bgBubbleAI,
                border: msg.role === "model" ? `1px solid ${bubbleBorder}` : "none",
                color: msg.role === "user" ? "#000" : textColor,
                fontSize: 17,
                lineHeight: 1.55,
                fontWeight: msg.role === "user" ? 500 : 400,
              }}>
                {msg.role === "model" && msg.animating
                  ? <AnimatedText text={msg.text} onDone={() => markDone(i)} />
                  : msg.role === "model"
                    ? <ColorizedText text={msg.text} />
                    : msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                padding: "14px 18px",
                borderRadius: "20px 20px 20px 5px",
                backgroundColor: bgBubbleAI,
                border: `1px solid ${bubbleBorder}`,
                display: "flex", gap: 7, alignItems: "center",
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    display: "block", height: 7, width: 7,
                    borderRadius: "50%", backgroundColor: "#00c805",
                    animation: `aiDot 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom controls: Back + title row, then input pill ── */}
        <div style={{
          flexShrink: 0,
          padding: `8px 12px calc(12px + env(safe-area-inset-bottom, 0px))`,
          backgroundColor: bgPanel,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
        }}>
          {/* Back + title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <button
              onClick={handleDismiss}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                backgroundColor: "#00c805", color: "#000",
                fontSize: 13, fontWeight: 600,
                padding: "5px 11px",
                borderRadius: 8,
                border: "none", cursor: "pointer",
              }}
            >
              <ChevronLeft style={{ height: 14, width: 14 }} />
              Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Sparkles style={{ height: 14, width: 14, color: "#00c805" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#00c805" }}>
                AI — {stock.symbol}
              </span>
            </div>
          </div>

          {/* Input pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            backgroundColor: inputBg,
            border: `1px solid ${inputBorder}`,
            borderRadius: 999,
            padding: "10px 12px 10px 20px",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Ask about ${stock.symbol}…`}
              style={{
                flex: 1, background: "transparent",
                border: "none", outline: "none",
                fontSize: 17,
                color: textColor,
                caretColor: "#00c805",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                flexShrink: 0, height: 36, width: 36,
                borderRadius: "50%",
                backgroundColor: input.trim() && !loading ? "#00c805" : "rgba(0,200,5,0.18)",
                color: input.trim() && !loading ? "#000" : "rgba(0,200,5,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                transition: "background-color 0.18s, color 0.18s",
              }}
            >
              <Send style={{ height: 15, width: 15 }} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes aiCursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
