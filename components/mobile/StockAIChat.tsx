"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, Sparkles } from "lucide-react";
import type { StockDetail } from "@/types/stock";

interface Message { role: "user" | "model"; text: string; animating?: boolean }

// Split AI text on [[+]]positive[[/+]] and [[-]]negative[[/-]] tags and render coloured spans
function ColorizedText({ text }: { text: string }) {
  const parts: { str: string; type: "neutral" | "pos" | "neg" }[] = [];
  const regex = /(\[\[\+\]\])([\s\S]*?)(\[\[\/\+\]\])|(\[\[-\]\])(.*?)(\[\[\/-\]\])/g;
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
    const h = stock.news.slice(0, 5).map(n => `• ${n.headline} (${n.source}) — ${n.url}`).join("\n");
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
  /** If provided, open state is controlled externally (e.g. desktop's own button) instead of the built-in floating pill. */
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in floating pill trigger — used when an external button opens the chat instead. */
  hideTrigger?: boolean;
}

export function StockAIChat({ stock, currentPrice, sentiment, metrics, externalOpen, onOpenChange, hideTrigger }: Props) {
  const [mounted, setMounted] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  function setOpen(v: boolean) {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [vp, setVp] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const scrollRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const touchStart  = useRef<{ x: number; y: number; time: number } | null>(null);
  const stockContext = buildStockContext(stock, currentPrice, sentiment, metrics);

  // Render via a portal straight into <body> — bypasses ancestor elements
  // (like <main>) that can pick up a transient CSS `transform` from page
  // transition animations. A transformed ancestor becomes a new containing
  // block for any `position: fixed` descendant, which silently breaks fixed
  // positioning. Portaling to <body> guarantees this can never happen, the
  // same way the always-reliable search button lives outside <main> too.
  useEffect(() => setMounted(true), []);

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

  // Lock body scroll (without jumping to top) only while chat is open
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const b = document.body;
    b.style.overflow = "hidden";
    b.style.position = "fixed";
    b.style.top      = `-${scrollY}px`;
    b.style.left     = "0";
    b.style.right    = "0";
    const t = setTimeout(() => inputRef.current?.focus(), 340);
    return () => {
      clearTimeout(t);
      b.style.overflow = b.style.position = b.style.top = b.style.left = b.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  function handleDismiss() {
    setOpen(false);
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

  // Tap-to-dismiss on empty space: a quick tap (not a scroll/drag) that lands
  // directly on the blank scroll area — not on a message bubble — closes the
  // chat, same as tapping the backdrop above it.
  function onEmptyAreaTouchStart(e: React.TouchEvent) {
    if (e.target !== e.currentTarget) { touchStart.current = null; return; }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  }
  function onEmptyAreaTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    const dt = Date.now() - touchStart.current.time;
    if (dx < 8 && dy < 8 && dt < 300) handleDismiss();
    touchStart.current = null;
  }
  function onEmptyAreaClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleDismiss();
  }

  const isLightMode = typeof document !== "undefined" && document.documentElement.classList.contains("light-mode");
  const bgBubbleAI    = isLightMode ? "rgba(240,240,245,1)" : "rgba(22,22,28,1)";
  const bubbleBorder  = isLightMode ? "rgba(0,0,0,0.10)"    : "rgba(255,255,255,0.10)";
  const textColor     = isLightMode ? "#1a1a1e"             : "#f0f0f2";

  const vpW = vp.width  || (typeof window !== "undefined" ? window.innerWidth  : 0);
  const vpH = vp.height || (typeof window !== "undefined" ? window.innerHeight : 0);

  // How much the keyboard (or Safari's chrome) is eating into the screen —
  // used to keep the pill glued just above it instead of drifting/getting covered.
  const winH = typeof window !== "undefined" ? window.innerHeight : 0;
  const keyboardInset = Math.max(0, winH - vpH - vp.top);
  const pillBottom = open && keyboardInset > 8
    ? `${keyboardInset + 12}px`
    : "calc(1.25rem + env(safe-area-inset-bottom))";

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop + messages — pinned to the exact visual viewport rectangle */}
      <div
        style={{
          position: "fixed",
          top: vp.top, left: vp.left, width: vpW, height: vpH,
          zIndex: 1000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.28s ease",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            backdropFilter:       open ? "blur(8px) brightness(0.65)" : "none",
            WebkitBackdropFilter: open ? "blur(8px) brightness(0.65)" : "none",
            transition: "backdrop-filter 0.28s ease, -webkit-backdrop-filter 0.28s ease",
          }}
          onClick={handleDismiss}
        />

        {/* Messages — scrollable, tapping blank space (not a bubble) dismisses */}
        <div
          ref={scrollRef}
          style={{
            position: "absolute",
            left: 0, right: 0,
            top: "max(3rem, calc(env(safe-area-inset-top) + 1rem))",
            bottom: `calc(${pillBottom} + 4.5rem)`,
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 12,
            padding: "16px 14px 8px",
          }}
          onClick={onEmptyAreaClick}
          onTouchStart={onEmptyAreaTouchStart}
          onTouchEnd={onEmptyAreaTouchEnd}
        >
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
      </div>

      {/* The pill — always mounted, same element morphs from a small circle
          (matching the search button exactly) into the full input bar. No
          separate bar/card behind it — this IS the input, elongated. */}
      {!hideTrigger && (
      <div
        className="fixed rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-positive overflow-hidden"
        style={{
          zIndex: 1002,
          bottom: pillBottom,
          right: open ? "1rem" : "1.25rem",
          width: open ? "calc(100vw - 2rem)" : "3.5rem",
          height: "3.5rem",
          transition: "width 0.32s cubic-bezier(0.2,0,0,1), right 0.32s cubic-bezier(0.2,0,0,1), bottom 0.2s ease",
        }}
      >
        {/* Closed state: the trigger icon */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: open ? 0 : 1,
            pointerEvents: open ? "none" : "auto",
            transition: "opacity 0.16s ease",
          }}
        >
          <Sparkles className="h-7 w-7" />
        </button>

        {/* Open state: the actual input row */}
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 8px 0 20px",
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transition: "opacity 0.22s ease",
            transitionDelay: open ? "0.14s" : "0s",
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
              fontSize: 16,
              caretColor: "#00c805",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              flexShrink: 0, height: 38, width: 38,
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
      )}

      {/* Controlled mode (e.g. desktop): render just the input row inline where hideTrigger is set and open is true, anchored bottom same as mobile pill would be, so typing still works without the floating circle. */}
      {hideTrigger && open && (
        <div
          className="fixed rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-positive overflow-hidden"
          style={{
            zIndex: 1002,
            bottom: pillBottom,
            right: "1rem",
            width: "calc(100vw - 2rem)",
            maxWidth: "480px",
            height: "3.5rem",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 8px 0 20px",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={`Ask about ${stock.symbol}…`}
              className="text-text-primary placeholder:text-text-muted"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, caretColor: "#00c805" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                flexShrink: 0, height: 38, width: 38,
                borderRadius: "50%",
                backgroundColor: input.trim() && !loading ? "#00c805" : "rgba(0,200,5,0.18)",
                color: input.trim() && !loading ? "#000" : "rgba(0,200,5,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
              }}
            >
              <Send style={{ height: 15, width: 15 }} />
            </button>
          </div>
        </div>
      )}

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
    </>,
    document.body
  );
}
