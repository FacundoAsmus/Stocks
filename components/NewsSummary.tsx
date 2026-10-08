"use client";

import { useEffect, useState } from "react";
import type { CompanyNewsArticle } from "@/types/stock";
import { AISummaryLoader, AISummaryText } from "@/components/CompanyDescription";

type SummaryState = { status: "loading" } | { status: "ready"; text: string } | { status: "error" };

export function NewsSummary({ symbol, articles }: { symbol: string; articles: CompanyNewsArticle[] }) {
  const [state, setState] = useState<SummaryState>({ status: "loading" });
  const fingerprint = articles.map(article => `${article.id}:${article.headline}:${article.summary}`).join("|");

  useEffect(() => {
    if (!articles.length) return;
    const controller = new AbortController();
    const cacheKey = `market-lens-news-summary:${symbol}:${articles.map(article => article.id).join(",")}`;
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      setState({ status: "ready", text: cached });
      return () => controller.abort();
    }

    setState({ status: "loading" });
    fetch("/api/news-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, articles: articles.map(({ id, headline, source, summary, datetime }) => ({ id, headline, source, summary, datetime })) }),
      signal: controller.signal,
    })
      .then(async response => {
        const payload = await response.json() as { summary?: string };
        if (!response.ok || !payload.summary) throw new Error("News summary unavailable");
        window.sessionStorage.setItem(cacheKey, payload.summary);
        setState({ status: "ready", text: payload.summary });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ status: "error" }); });

    return () => controller.abort();
  // fingerprint makes fresh headlines refresh the summary even when IDs persist.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, fingerprint]);

  return (
    <section className="mt-8">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent">AI news summary</p>
      {state.status === "loading" && <AISummaryLoader />}
      {state.status === "ready" && <AISummaryText text={state.text} />}
      {state.status === "error" && <p className="text-[1.05rem] text-text-muted">News summary is not available right now.</p>}
    </section>
  );
}
