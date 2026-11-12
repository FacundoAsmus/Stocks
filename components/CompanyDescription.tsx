"use client";

import { useEffect, useState } from "react";
import { TextRevealCaret, useTypingReveal } from "@/components/TextReveal";
import { AIStarLoader } from "@/components/AIStarLoader";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import { AIUnavailableNotice } from "@/components/AIUnavailableNotice";

type DescriptionState =
  | { status: "loading"; text: "" }
  | { status: "ready"; text: string }
  | { status: "error"; text: "" };

export function AISummaryLoader() {
  return (
    <div className="flex h-20 items-center justify-start" aria-label="Loading description" role="status">
      <AIStarLoader size="lg" label="Creating AI summary" />
    </div>
  );
}

export function AISummaryText({ text }: { text: string }) {
  const { visibleLength, complete } = useTypingReveal(text.length, text, 6);

  return (
    <p className="animate-[description-fade_240ms_ease-out_both] text-[1.05rem] text-text-primary whitespace-pre-line">
      {text.slice(0, visibleLength)}
      {!complete && <TextRevealCaret />}
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
      <p className="-ml-3 sm:-ml-5 mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-accent"><OptionalSvgIcon name="description" className="h-5 w-5" />Description</p>
      {state.status === "loading" && <AISummaryLoader />}
      {state.status === "ready" && <AISummaryText text={state.text} />}
      {state.status === "error" && <AIUnavailableNotice />}
    </section>
  );
}
