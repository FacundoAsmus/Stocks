"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type OptionalSvgIconProps = {
  name: string;
  selected?: boolean;
  className: string;
  colorClassName?: string;
};

/**
 * Loads user-provided SVGs from public/icons, tinting the SVG through a mask.
 * Missing files render no element, so optional icon slots do not leave gaps.
 */
export function OptionalSvgIcon({ name, selected = false, className, colorClassName = "text-accent" }: OptionalSvgIconProps) {
  const fileName = `${name}${selected ? "-selected" : ""}`;
  const src = `/icons/${fileName}.svg`;
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    setAvailable(false);
    const probe = new window.Image();
    probe.onload = () => { if (alive) setAvailable(true); };
    probe.onerror = () => { if (alive) setAvailable(false); };
    probe.src = src;
    return () => { alive = false; };
  }, [src]);

  if (!available) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", colorClassName, className)}
      style={{
        backgroundColor: "currentColor",
        maskImage: `url("${src}")`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: `url("${src}")`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
