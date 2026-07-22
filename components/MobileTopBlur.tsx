"use client";

import { usePathname } from "next/navigation";

// Root-level placement prevents Safari from compositing separate backdrop
// samples for sticky headers and the top safe area.
//
// NOTE: this intentionally does NOT use EdgeBlur's `TopBlur` (which stacks
// 5 backdrop-filter layers). Stacking backdrop-filter layers inside a
// fixed, safe-area-padded container is the same WebKit bug already called
// out in EdgeBlur's `HeaderTopBlur` comment — it renders as a hard seam /
// flat block right around the safe-area boundary on real iOS devices
// instead of a smooth fade. Using a single layer with a full-height
// gradient mask avoids that and gives an actual gradient blur.
export function MobileTopBlur() {
  const pathname = usePathname();
  const height = pathname.startsWith("/stock/")
    ? "calc(env(safe-area-inset-top) + 4.5rem)"
    : pathname === "/watchlist"
      ? "calc(env(safe-area-inset-top) + 5rem)"
      : "calc(env(safe-area-inset-top) + 7rem)";

  return (
    <div
      className="fixed inset-x-0 top-0 isolate z-20 pointer-events-none lg:hidden"
      style={{ height }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
    </div>
  );
}
