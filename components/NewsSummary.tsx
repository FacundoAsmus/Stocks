"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyNewsArticle } from "@/types/stock";
import { AISummaryLoader } from "@/components/CompanyDescription";
import { AIUnavailableNotice } from "@/components/AIUnavailableNotice";

type SummaryState = { status: "loading" } | { status: "ready"; text: string } | { status: "error" };

type SummaryPart = { text: string; format: "plain" | "company" | "peer" | "person" | "product" | "positive" | "negative" };

function NewsSummaryText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const result: SummaryPart[] = [];
    const pattern = /\[\[company\]\]([\s\S]*?)\[\[\/company\]\]|\[\[peer\]\]([\s\S]*?)\[\[\/peer\]\]|\[\[person\]\]([\s\S]*?)\[\[\/person\]\]|\[\[product\]\]([\s\S]*?)\[\[\/product\]\]|\[\[\+\]\]([\s\S]*?)\[\[\/\+\]\]|\[\[\-\]\]([\s\S]*?)\[\[\/\-\]\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) result.push({ text: text.slice(lastIndex, match.index), format: "plain" });
      if (match[1] !== undefined) result.push({ text: match[1], format: "company" });
      else if (match[2] !== undefined) result.push({ text: match[2], format: "peer" });
      else if (match[3] !== undefined) result.push({ text: match[3], format: "person" });
      else if (match[4] !== undefined) result.push({ text: match[4], format: "product" });
      else if (match[5] !== undefined) result.push({ text: match[5], format: "positive" });
      else result.push({ text: match[6] ?? "", format: "negative" });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) result.push({ text: text.slice(lastIndex), format: "plain" });
    return result;
  }, [text]);
  const totalLength = parts.reduce((sum, part) => sum + part.text.length, 0);
  const [visibleLength, setVisibleLength] = useState(0);
  const complete = visibleLength >= totalLength;

  useEffect(() => {
    setVisibleLength(0);
    const timer = window.setInterval(() => {
      setVisibleLength(length => {
        if (length >= totalLength) {
          window.clearInterval(timer);
          return length;
        }
        return Math.min(totalLength, length + 1);
      });
    }, 7);
    return () => window.clearInterval(timer);
  }, [text, totalLength]);

  let remaining = visibleLength;
  return (
    <p className="animate-[description-fade_240ms_ease-out_both] whitespace-pre-line text-[1.05rem] text-text-primary">
      {parts.map((part, index) => {
        const visibleText = part.text.slice(0, Math.max(0, Math.min(part.text.length, remaining)));
        remaining -= part.text.length;
        if (!visibleText) return null;
        const style = part.format === "company"
          ? { fontWeight: 700 }
          : part.format === "peer"
            ? { color: "#f97316", fontWeight: 600 }
            : part.format === "person"
              ? { color: "#facc15", fontWeight: 600 }
              : part.format === "product"
                ? { color: "#7dd3fc", fontWeight: 600 }
                : part.format === "positive"
                  ? { color: "var(--color-positive)", fontWeight: 600 }
                  : part.format === "negative"
                    ? { color: "var(--color-negative)", fontWeight: 600 }
                    : undefined;
        return <span key={index} style={style}>{visibleText}</span>;
      })}
      {!complete && <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] align-[-0.12em] rounded-sm bg-positive" style={{ boxShadow: "0 0 6px 2px rgba(0,200,5,0.7)", animation: "description-cursor .7s ease-in-out infinite" }} />}
      <style>{`@keyframes description-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } } @keyframes description-cursor { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }`}</style>
    </p>
  );
}

export function NewsSummary({ symbol, companyName, articles }: { symbol: string; companyName: string; articles: CompanyNewsArticle[] }) {
  const [state, setState] = useState<SummaryState>({ status: "loading" });
  const fingerprint = articles.map(article => `${article.id}:${article.headline}:${article.summary}`).join("|");

  useEffect(() => {
    if (!articles.length) return;
    const controller = new AbortController();
    const cacheKey = `market-lens-news-summary-v3:${symbol}:${articles.map(article => article.id).join(",")}`;
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      setState({ status: "ready", text: cached });
      return () => controller.abort();
    }

    setState({ status: "loading" });
    fetch("/api/news-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, companyName, articles: articles.map(({ id, headline, source, summary, datetime }) => ({ id, headline, source, summary, datetime })) }),
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
  }, [symbol, companyName, fingerprint]);

  return (
    <section className="mt-6 mb-6">
      {state.status === "loading" && <AISummaryLoader />}
      {state.status === "ready" && <NewsSummaryText text={state.text} />}
      {state.status === "error" && <AIUnavailableNotice />}
    </section>
  );
}
