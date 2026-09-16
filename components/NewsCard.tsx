import { ExternalLink } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { CompanyNewsArticle } from "@/types/stock";

export function NewsCard({ article }: { article: CompanyNewsArticle }) {
  return (
    <article className="rounded-md border border-[#3a3a42] bg-black p-5 transition-all duration-200 hover:border-positive/50 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl hover:shadow-black/30">
      <div className="flex items-start gap-4">
        {article.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image}
            alt=""
            className="hidden h-20 w-24 rounded-md object-cover sm:block"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>{article.source || "Unknown source"}</span>
            <span aria-hidden>/</span>
            <time>{formatDateTime(article.datetime)}</time>
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-text-primary">
            {article.headline}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">{article.summary}</p>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-sky-300"
          >
            Read article
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}
