"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockDetail } from "@/types/stock";

// ─── Types ────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "model";
  text: string;
}

interface StockAIChatProps {
  stock: StockDetail;
  currentPrice: number;
  sentiment: { score: number; drivers: string[] };
  metrics: Record<string, number | string | null> | undefined;
}

// ─── Build system context from stock data ─────────────────────────────────
function buildStockContext(
  stock: StockDetail,
  currentPrice: number,
  sentiment: { score: number; drivers: string[] },
  metrics: Record<string, number | string | null> | undefined,
): string {
  const q = stock.quote;

  const metricsStr = metrics
    ? Object.entries(metrics)
        .filter(([, v]) => v !== null && v !== undefined)
        .slice(0, 16)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "N/A";

  const newsStr = stock.news
    .slice(0, 6)
    .map(n => `- ${n.headline} (${n.source}, ${n.url})`)
    .join("\n");

  const analystStr = stock.priceTarget
    ? `Analyst price target: mean $${stock.priceTarget.targetMean?.toFixed(2) ?? "N/A"}, high $${stock.priceTarget.targetHigh?.toFixed(2) ?? "N/A"}, low $${stock.priceTarget.targetLow?.toFixed(2) ?? "N/A"}`
    : "No analyst price target data.";

  const recStr = stock.recommendations?.length
    ? `Recommendations (latest): buy=${stock.recommendations[0].buy}, hold=${stock.recommendations[0].hold}, sell=${stock.recommendations[0].sell}, strongBuy=${stock.recommendations[0].strongBuy}, strongSell=${stock.recommendations[0].strongSell}`
    : "No recommendation data.";

  return `You are an AI financial analyst assistant embedded in a stock research app. You are viewing the individual stock page for ${stock.profile.name ?? stock.symbol} (${stock.symbol}).

Be concise, professional, and non-personal. Do not give personal investment advice. Use the data below to answer questions accurately.

STOCK DATA:
- Company: ${stock.profile.name ?? stock.symbol} (${stock.symbol})
- Industry: ${stock.profile.finnhubIndustry ?? "N/A"}
- Exchange: ${stock.profile.exchange ?? "N/A"}
- Current Price: $${currentPrice.toFixed(2)}
- Day Change: ${q.d?.toFixed(2) ?? "N/A"} (${q.dp?.toFixed(2) ?? "N/A"}%)
- Day High: $${q.h?.toFixed(2) ?? "N/A"}, Day Low: $${q.l?.toFixed(2) ?? "N/A"}
- Previous Close: $${q.pc?.toFixed(2) ?? "N/A"}
- Market Cap: $${stock.profile.marketCapitalization ? (stock.profile.marketCapitalization / 1000).toFixed(2) + "B" : "N/A"}
- Sentiment Score: ${sentiment.score}/100
- Key Metrics: ${metricsStr}
- ${analystStr}
- ${recStr}

RECENT NEWS:
${newsStr}

Answer questions about this stock using the above data. Always write complete sentences — never stop mid-sentence. Keep answers concise (under 150 words) unless the user asks for more detail.`;
}

// ─── Gemini API call (proxied through /api/ai so the key stays server-side) ─
async function callGemini(
  systemPrompt: string,
  history: Message[],
  userText: string,
  signal: AbortSignal,
): Promise<string> {
  const contents = [
    { role: "user",  parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I have the stock data and am ready to answer questions." }] },
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const res = await fetch("/api/ai", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts
    ?.map(p => p.text ?? "")
    .join("")
    .trim() ?? "No response received.";
}

// ─── Chat panel ───────────────────────────────────────────────────────────
export function StockAIChat(props: StockAIChatProps) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);
  const abortRef                = useRef<AbortController | null>(null);
  const scrollRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);
  // Track if a scroll is in progress (to distinguish tap vs scroll on backdrop)
  const backdropScrollRef       = useRef(false);

  const systemPrompt = buildStockContext(
    props.stock, props.currentPrice, props.sentiment, props.metrics
  );

  // Detect keyboard height via visualViewport
  useEffect(() => {
    if (!open) return;
    function update() {
      if (!window.visualViewport) return;
      const keyH = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
      setKeyboardH(Math.max(0, keyH));
    }
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    update();
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function dismiss() {
    abortRef.current?.abort();
    setOpen(false);
    setMessages([]);
    setInput("");
    setLoading(false);
    setKeyboardH(0);
  }

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const reply = await callGemini(systemPrompt, messages.concat(userMsg), text, ctrl.signal);
      setMessages(prev => [...prev, { role: "model", text: reply }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages(prev => [...prev, { role: "model", text: "Sorry, something went wrong. Please try again." }]);
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, systemPrompt]);

  // Input pill bottom: sits above keyboard (or safe area)
  const inputBottom = keyboardH > 0
    ? `${keyboardH}px`
    : `calc(env(safe-area-inset-bottom) + 0.5rem)`;

  return (
    <>
      {/* AI trigger button — right side of top bar */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-positive/15 border border-positive/40 text-positive transition-all active:scale-90"
        aria-label="Ask AI about this stock"
      >
        <Sparkles className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* ── Backdrop: blur + dim. Tap = dismiss, scroll = pass-through ── */}
          <div
            className="fixed inset-0 z-40"
            style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", background: "rgba(0,0,0,0.35)" }}
            onTouchStart={() => { backdropScrollRef.current = false; }}
            onTouchMove={() => { backdropScrollRef.current = true; }}
            onTouchEnd={() => {
              // Only dismiss on a true tap (no scroll movement)
              if (!backdropScrollRef.current) dismiss();
            }}
            onClick={dismiss}
          />

          {/* ── Chat message list ─────────────────────────────────────── */}
          <div
            ref={scrollRef}
            className="fixed inset-x-0 z-41 overflow-y-auto"
            style={{
              top: 0,
              bottom: keyboardH > 0
                ? `calc(${keyboardH}px + 3rem)`
                : `calc(env(safe-area-inset-bottom) + 3.5rem)`,
              paddingTop: "6rem",
              paddingBottom: "1rem",
              paddingLeft: "1rem",
              paddingRight: "1rem",
              pointerEvents: "none", // let taps fall through to backdrop
            }}
          >
            <div style={{ pointerEvents: "auto" }} /* only message bubbles catch events */>
              {messages.length === 0 && (
                <div className="flex justify-center mb-4">
                  <span className="text-xs text-white/50 bg-black/40 rounded-full px-3 py-1.5 backdrop-blur-sm">
                    Ask me anything about {props.stock.symbol}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "model" && (
                      <span className="h-6 w-6 rounded-full bg-positive flex items-center justify-center shrink-0 mr-2 mt-0.5">
                        <Sparkles className="h-3 w-3 text-black" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg",
                        m.role === "user"
                          ? "bg-positive text-black rounded-br-sm font-medium"
                          : "bg-black/80 text-white/90 rounded-bl-sm backdrop-blur-md border border-white/10"
                      )}
                      style={{ animation: "bubbleIn 0.2s ease both" }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <span className="h-6 w-6 rounded-full bg-positive flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <Sparkles className="h-3 w-3 text-black" />
                    </span>
                    <div className="bg-black/80 border border-white/10 backdrop-blur-md rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/50"
                          style={{ animation: `dot-bounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Input pill — floats above keyboard ───────────────────── */}
          <div
            className="fixed inset-x-0 z-50 px-3 transition-all duration-200"
            style={{ bottom: inputBottom }}
          >
            <div className="flex items-center gap-2 rounded-full bg-black/90 border border-white/15 backdrop-blur-xl px-4 py-2 shadow-2xl">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask about this stock…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all",
                  input.trim() && !loading
                    ? "bg-positive text-black active:scale-90"
                    : "bg-white/10 text-white/30"
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: scale(0.94) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scaleY(1);   opacity: 0.5; }
          40%            { transform: scaleY(1.6); opacity: 1;   }
        }
      `}</style>
    </>
  );
}
