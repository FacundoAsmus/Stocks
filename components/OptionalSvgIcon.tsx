"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type OptionalSvgIconProps = {
  name: string;
  selected?: boolean;
  fallbackToBaseWhenSelected?: boolean;
  className: string;
  colorClassName?: string;
  color?: string;
};

/**
 * Loads user-provided SVGs from public/icons, tinting the SVG through a mask.
 * Missing files fall back to the red `icon-error.svg` marker.
 */
export function OptionalSvgIcon({
  name,
  selected = false,
  fallbackToBaseWhenSelected = false,
  className,
  colorClassName = "text-accent",
  color,
}: OptionalSvgIconProps) {
  const fileName = `${name}${selected ? "-selected" : ""}`;
  const src = `/icons/${fileName}.svg`;
  const baseSrc = `/icons/${name}.svg`;
  const errorSrc = "/icons/icon-error.svg";
  const [loadedSources, setLoadedSources] = useState<string[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    let fallbackRequested = false;
    const probe = (source: string, isFallback = false) => {
      const image = new window.Image();
      image.onload = () => {
        if (alive) setLoadedSources((sources) => sources.includes(source) ? sources : [...sources, source]);
      };
      image.onerror = () => {
        if (alive) setFailedSources((sources) => sources.includes(source) ? sources : [...sources, source]);
        if (alive && !isFallback && !fallbackRequested && name !== "icon-error") {
          fallbackRequested = true;
          probe(errorSrc, true);
        }
      };
      image.src = source;
    };
    probe(src);
    if (selected && fallbackToBaseWhenSelected && src !== baseSrc) probe(baseSrc);
    return () => { alive = false; };
  }, [baseSrc, errorSrc, fallbackToBaseWhenSelected, name, selected, src]);

  const loadedPrimary = loadedSources.includes(src)
    ? src
    : selected && fallbackToBaseWhenSelected && loadedSources.includes(baseSrc)
      ? baseSrc
      : null;
  const missingPrimary = failedSources.includes(src)
    && (!selected || !fallbackToBaseWhenSelected || src === baseSrc || failedSources.includes(baseSrc));
  const usingErrorIcon = !loadedPrimary && missingPrimary && name !== "icon-error" && loadedSources.includes(errorSrc);
  const visibleSrc = loadedPrimary ?? (usingErrorIcon || name === "icon-error" ? (loadedSources.includes(src) ? src : null) : null);

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", usingErrorIcon || name === "icon-error" ? "text-negative" : colorClassName, className)}
      style={{
        backgroundColor: usingErrorIcon || name === "icon-error" ? "currentColor" : color ?? "currentColor",
        maskImage: visibleSrc ? `url("${visibleSrc}")` : undefined,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: visibleSrc ? `url("${visibleSrc}")` : undefined,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
