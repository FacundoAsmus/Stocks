"use client";

import { useState } from "react";

type MarketIconProps = {
  icon?: string;
  className: string;
};

export function MarketIcon({ icon = "stock_fallback_icon.svg", className }: MarketIconProps) {
  const shouldStartHidden = className.split(/\s+/).includes("hidden");
  const frameClassName = className.split(/\s+/).filter((token) => token !== "hidden").join(" ");
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const useFallback = icon === "stock_fallback_icon.svg" || failedIcon === icon;
  return (
    <span
      aria-hidden="true"
      className={`market-icon-frame inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 ${frameClassName}`}
      style={{ display: shouldStartHidden ? "none" : "inline-flex", borderRadius: "50%" }}
    >
      {useFallback ? (
        <span
          className="h-[72%] w-[72%]"
          style={{
            backgroundColor: "var(--color-accent)",
            maskImage: 'url("/icons/stock_fallback_icon.svg")',
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskImage: 'url("/icons/stock_fallback_icon.svg")',
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
          }}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/icons/${icon}`}
          alt=""
          className="h-[72%] w-[72%] object-contain"
          onError={() => setFailedIcon(icon)}
          style={icon === "tech_icon.svg" ? { filter: "invert(87%) sepia(94%) saturate(671%) hue-rotate(29deg) brightness(102%) contrast(106%)" } : undefined}
        />
      )}
    </span>
  );
}
