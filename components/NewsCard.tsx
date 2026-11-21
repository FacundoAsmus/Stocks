import { memo } from "react";

import { NewsImage } from "@/components/NewsImage";
import type { CompanyNewsArticle } from "@/types/stock";

// Redesigned to match the shape/feel of the pre-merge stock card
// (components/_snapshot/StockCard.snapshot.tsx) — same rounded-2xl black
// card, border, and hover lift/scale/shadow, and the same vertical-rectangle
// proportions (that card ran ~3-up in its own grid at ~400px wide × 440px
// tall — a portrait shape, not a flat wide one). `aspect-[3/4]` locks that
// same portrait shape at any card width, rather than a fixed pixel height
// that would flatten out in a wider grid column.
// The image sits slightly inset within the top 3/4, leaving an even gap from
// the card edges while keeping its original centered position.
export const NewsCard = memo(function NewsCard({ article, showSummary = true, compactTitle = false }: { article: CompanyNewsArticle; showSummary?: boolean; compactTitle?: boolean }) {
  return (
    <article
      className="group relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl border transition-[transform,border-color] duration-300 ease-out hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-2 hover:scale-[1.02]"
      style={{ backgroundColor: "var(--phone-menu-background)", borderColor: "var(--phone-menu-background)" }}
    >
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="flex h-full w-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Image — 95% size, centered in the top 3/4 with rounded corners. */}
        <div className="relative h-3/4 w-full shrink-0" style={{ backgroundColor: "var(--phone-menu-background)" }}>
          <div className="absolute inset-[2.5%] overflow-hidden rounded-xl">
            <NewsImage src={article.image} />
          </div>
        </div>

        <div className="news-card-body flex h-1/4 shrink-0 flex-col items-start justify-center gap-1 px-3 py-2">
          <h3 className={`line-clamp-2 ${compactTitle ? "text-[11px]" : "text-[13px]"} font-semibold leading-snug text-text-primary`}>
            {article.headline}
          </h3>
          {showSummary && (
            <p className="line-clamp-2 text-[11px] leading-snug text-gray-400">
              {article.summary}
            </p>
          )}
        </div>
      </a>
    </article>
  );
});
