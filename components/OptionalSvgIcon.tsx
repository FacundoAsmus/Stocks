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
  const [loadedSources, setLoadedSources] = useState<string[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const probe = (source: string) => {
      const image = new window.Image();
      image.onload = () => {
        if (alive) setLoadedSources((sources) => sources.includes(source) ? sources : [...sources, source]);
      };
      image.onerror = () => {
        if (alive) setFailedSources((sources) => sources.includes(source) ? sources : [...sources, source]);
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
  if (!visibleSrc) {
    const candidatesFailed = failedSources.includes(src)
      && (!selected || !fallbackToBaseWhenSelected || src === baseSrc || failedSources.includes(baseSrc));
    if (name === "icon-error" || !candidatesFailed) return null;
    return <OptionalSvgIcon name="icon-error" className={className} colorClassName="text-negative" />;
  }
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
