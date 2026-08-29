import { Newspaper } from "lucide-react";

import type { CompanyNewsArticle } from "@/types/stock";

// Redesigned to match the shape/feel of the pre-merge stock card
// (components/_snapshot/StockCard.snapshot.tsx) — same rounded-2xl black
// card, border, and hover lift/scale/shadow — just at ~half that card's
// size, and built around the article image instead of a price chart:
// the image fills the top 3/4 of the card edge-to-edge (the card's own
// rounded corners + overflow-hidden do the clipping — the image itself has
// no border-radius of its own), and the headline sits in the bottom 1/4.
export function NewsCard({ article }: { article: CompanyNewsArticle }) {
  return (
    <article
      className="group relative flex h-[220px] w-full flex-col overflow-hidden rounded-2xl border border-[#3a3a42] bg-black transition-all duration-300 ease-out hover:border-positive/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-2 hover:scale-[1.02]"
    >
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="flex h-full w-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Image — top 3/4, flush to the card's edges */}
        <div className="relative w-full flex-[3] bg-panel-muted">
          {article.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Newspaper className="h-8 w-8 text-text-muted opacity-40" aria-hidden />
            </div>
          )}
        </div>

        {/* Title — bottom 1/4 */}
        <div className="flex flex-1 items-center px-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-text-primary">
            {article.headline}
          </h3>
        </div>
      </a>
    </article>
  );
}
