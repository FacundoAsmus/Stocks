"use client";

import { useEffect, useState } from "react";
import { AIStarLoader } from "@/components/AIStarLoader";

type DescriptionState =
  | { status: "loading"; text: "" }
  | { status: "ready"; text: string }
  | { status: "error"; text: "" };

function DescriptionLoader() {
  return (
    <div className="flex h-20 items-center justify-center" aria-label="Loading description" role="status">
      <AIStarLoader size="lg" label="Creating AI summary" />
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
    const startedAt = Date.now();
    const MIN_LOADER_MS = 700;
    setState({ status: "loading", text: "" });

    const finish = (nextState: DescriptionState) => {
      const remaining = Math.max(0, MIN_LOADER_MS - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (!controller.signal.aborted) setState(nextState);
      }, remaining);
    };

    fetch(`/api/company-description?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Description unavailable");
        const body = await response.json() as { description?: string };
        if (!body.description) throw new Error("Description unavailable");
        finish({ status: "ready", text: body.description });
      })
      .catch(() => {
        finish({ status: "error", text: "" });
      });

    return () => controller.abort();
  }, [symbol]);

  return (
    <section className={className}>
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent">Description</p>
      {state.status === "loading" && <DescriptionLoader />}
      {state.status === "ready" && <RevealedText text={state.text} />}
      {state.status === "error" && <p className="text-[1.05rem] text-text-muted">Descriptions are not avaliable right now</p>}
    </section>
  );
}
