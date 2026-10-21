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
 * Missing files render no element, so optional icon slots do not leave gaps.
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
  const [loadedSources, setLoadedSources] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const probe = (source: string) => {
      const image = new window.Image();
      image.onload = () => {
        if (alive) setLoadedSources((sources) => sources.includes(source) ? sources : [...sources, source]);
      };
      image.src = source;
    };
    probe(src);
    if (selected && fallbackToBaseWhenSelected && src !== baseSrc) probe(baseSrc);
    return () => { alive = false; };
  }, [baseSrc, fallbackToBaseWhenSelected, selected, src]);

  const visibleSrc = loadedSources.includes(src)
    ? src
    : selected && fallbackToBaseWhenSelected && loadedSources.includes(baseSrc)
      ? baseSrc
      : null;
  if (!visibleSrc) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", colorClassName, className)}
      style={{
        backgroundColor: color ?? "currentColor",
        maskImage: `url("${visibleSrc}")`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: `url("${visibleSrc}")`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
