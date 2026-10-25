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
// Built around the article image instead of a price chart: the image fills
// the top 3/4 of the card edge-to-edge (the card's own rounded corners +
// overflow-hidden do the clipping — the image itself has no border-radius
// of its own), and the headline sits in the bottom 1/4.
export const NewsCard = memo(function NewsCard({ article, showSummary = true, compactTitle = false }: { article: CompanyNewsArticle; showSummary?: boolean; compactTitle?: boolean }) {
  return (
    <article
      className="group relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl border border-[#3a3a42] bg-black transition-[transform,border-color] duration-300 ease-out hover:border-accent hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-2 hover:scale-[1.02]"
    >
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="flex h-full w-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Image — top 3/4, flush to the card's edges */}
        <div className="relative h-3/4 w-full shrink-0 bg-panel-muted">
          <NewsImage src={article.image} />
        </div>

        <div className="flex h-1/4 shrink-0 flex-col items-start justify-center gap-1 px-3 py-2">
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
