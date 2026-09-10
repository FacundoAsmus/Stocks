"use client";

import { useEffect, useState } from "react";

type DescriptionState =
  | { status: "loading"; text: "" }
  | { status: "ready"; text: string }
  | { status: "error"; text: "" };

function ChartLoader() {
  return (
    <div className="flex h-20 items-center justify-center" aria-label="Loading description" role="status">
      <style>{`
        @keyframes description-candle-breathe {
          0%, 100% { transform: scaleY(.52); opacity: .32; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes description-wick-breathe {
          0%, 100% { transform: scaleY(.45); opacity: .3; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .description-candle-1 { animation: description-candle-breathe 1.8s ease-in-out infinite; transform-origin: bottom; }
        .description-candle-2 { animation: description-candle-breathe 1.8s ease-in-out infinite -.6s; transform-origin: bottom; }
        .description-candle-3 { animation: description-candle-breathe 1.8s ease-in-out infinite -1.2s; transform-origin: bottom; }
        .description-wick-1 { animation: description-wick-breathe 1.8s ease-in-out infinite; transform-origin: bottom; }
        .description-wick-2 { animation: description-wick-breathe 1.8s ease-in-out infinite -.6s; transform-origin: bottom; }
        .description-wick-3 { animation: description-wick-breathe 1.8s ease-in-out infinite -1.2s; transform-origin: bottom; }
      `}</style>
      <div className="flex items-end gap-[5px]">
        <div className="flex flex-col items-center gap-[2px]">
          <div className="description-wick-1 h-1.5 w-[2px] rounded-full bg-positive/50" />
          <div className="description-candle-1 h-4 w-3.5 rounded-sm bg-positive/50" />
        </div>
        <div className="flex flex-col items-center gap-[2px]">
          <div className="description-wick-2 h-2 w-[2px] rounded-full bg-positive/70" />
          <div className="description-candle-2 h-6 w-3.5 rounded-sm bg-positive/70" />
        </div>
        <div className="flex flex-col items-center gap-[2px]">
          <div className="description-wick-3 h-2.5 w-[2px] rounded-full bg-positive" />
          <div className="description-candle-3 h-8 w-3.5 rounded-sm bg-positive" />
        </div>
      </div>
    </div>
  );
}

function RevealedText({ text }: { text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);
  const complete = visibleLength >= text.length;

  useEffect(() => {
    setVisibleLength(0);
    const timer = window.setInterval(() => {
      setVisibleLength((length) => {
        if (length >= text.length) {
          window.clearInterval(timer);
          return length;
        }
        return length + 1;
      });
    }, 7);
    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <p className="animate-[description-fade_240ms_ease-out_both] text-[1.05rem] text-text-primary whitespace-pre-line">
      <style>{`
        @keyframes description-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes description-cursor { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
      `}</style>
      {text.slice(0, visibleLength)}
      {!complete && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1em] w-[2px] align-[-0.12em] rounded-sm bg-positive"
          style={{ boxShadow: "0 0 6px 2px rgba(0,200,5,0.7)", animation: "description-cursor .7s ease-in-out infinite" }}
        />
      )}
    </p>
  );
}

export function CompanyDescription({ symbol, className = "" }: { symbol: string; className?: string }) {
  const [state, setState] = useState<DescriptionState>({ status: "loading", text: "" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", text: "" });

    fetch(`/api/company-description?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Description unavailable");
        const body = await response.json() as { description?: string };
        if (!body.description) throw new Error("Description unavailable");
        setState({ status: "ready", text: body.description });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error", text: "" });
      });

    return () => controller.abort();
  }, [symbol]);

  return (
    <section className={className}>
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent">Description</p>
      {state.status === "loading" && <ChartLoader />}
      {state.status === "ready" && <RevealedText text={state.text} />}
      {state.status === "error" && <p className="text-[1.05rem] text-text-muted">Descriptions are not avaliable right now</p>}
    </section>
  );
}
