"use client";

import { MarketIcon } from "@/components/MarketIcon";
import Image from "next/image";
import type { SyntheticEvent } from "react";

// Small Client Component wrapper around the logo-with-fallback pattern.
// DesktopStockDetail.tsx (which renders this) is a Server Component, and
// Server Components can't attach event handlers (like onError) directly to
// a plain <img> — only actual Client Components can carry interactivity.
// Extracting just this bit into its own "use client" component lets the
// rest of the page stay server-rendered while this piece still gets to use
// onError for the graceful image-fails-to-load fallback.
export function StockLogo({
  logo,
  sizeClassName = "h-14 w-14",
  size = 64,
  shape = "rounded",
  imageClassName,
  fallbackClassName,
  fallbackDisplay = "inline-flex",
}: {
  logo?: string;
  sizeClassName?: string;
  size?: number;
  shape?: "rounded" | "rounded-md" | "circle";
  imageClassName?: string;
  fallbackClassName?: string;
  fallbackDisplay?: "inline-flex" | "flex";
}) {
  const shapeClassName = shape === "circle" ? "rounded-full" : shape === "rounded-md" ? "rounded-md" : "rounded-3xl";
  let useNextImage = false;
  if (logo) {
    try {
      const hostname = new URL(logo).hostname.toLowerCase();
      useNextImage = hostname === "finnhub.io" || hostname.endsWith(".finnhub.io");
    } catch {
      useNextImage = false;
    }
  }
  const displayedImageClassName = imageClassName ?? `${sizeClassName} ${shapeClassName} border border-white/10 bg-white/5 object-contain`;
  const displayedFallbackClassName = `${fallbackClassName ?? `${sizeClassName} ${shapeClassName} object-contain`} ${logo ? "hidden" : ""}`;
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
    const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
    if (fallback) fallback.style.display = fallbackDisplay;
  };
  return (
    <>
      {logo ? (
        useNextImage ? (
          <Image src={logo} alt="" width={size} height={size} sizes={`${size}px`} className={displayedImageClassName} onError={handleError} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className={displayedImageClassName} onError={handleError} />
        )
      ) : null}
      <MarketIcon className={displayedFallbackClassName} />
    </>
  );
}
