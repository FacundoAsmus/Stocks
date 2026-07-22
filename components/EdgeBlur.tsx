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

// Self-contained blur meant to be the FIRST child of a sticky/positioned
// header (position: sticky already qualifies as a containing block). It
// fills the header's own box exactly — including any safe-area-inset-top
// padding, so it reaches the true top of the screen — and fades from
// opaque at the top to transparent at the header's own bottom edge. Because
// it's a normal DOM child rendered first, the header's actual text/buttons
// simply paint after it in the same box and sit above it automatically —
// no separate global overlay, no z-index race against anything else.
export function HeaderTopBlur() {
  const blurLayers = [1, 2, 3, 6, 12];
  return (
    <div className="absolute inset-0 isolate -z-10 pointer-events-none" aria-hidden>
      {blurLayers.map((blur) => (
        <div
          key={blur}
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${blur}px)`,
            WebkitBackdropFilter: `blur(${blur}px)`,
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
      ))}
    </div>
  );
}
