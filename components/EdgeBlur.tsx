"use client";

interface EdgeBlurProps {
  position?: "top" | "bottom";
  height?: number;
  className?: string;
}

// Progressive blur: several stacked layers of increasing blur strength,
// each masked to fade from opaque (at the edge) to transparent (toward the
// content) — so text/images scrolling underneath soften out gradually
// instead of hard-clipping under fixed chrome (the mobile bottom nav pill).
export function EdgeBlur({ position = "bottom", height = 130, className = "" }: EdgeBlurProps) {
  const blurLayers = [1, 2, 3, 6, 12];
  const isTop = position === "top";
  return (
    <div
      className={`fixed inset-x-0 isolate z-20 pointer-events-none ${isTop ? "top-0" : "bottom-0"} ${className}`}
      style={{ height }}
    >
      {blurLayers.map((blur) => (
        <div
          key={blur}
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${blur}px)`,
            WebkitBackdropFilter: `blur(${blur}px)`,
            maskImage: `linear-gradient(to ${isTop ? "bottom" : "top"}, black, transparent)`,
            WebkitMaskImage: `linear-gradient(to ${isTop ? "bottom" : "top"}, black, transparent)`,
          }}
        />
      ))}
    </div>
  );
}

// Convenience exports for specific positions
export function TopBlur({ height = 130 }: { height?: number }) {
  return <EdgeBlur position="top" height={height} />;
}

export function BottomBlur({ height = 90 }: { height?: number }) {
  return <EdgeBlur position="bottom" height={height} />;
}
