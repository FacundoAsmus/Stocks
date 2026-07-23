"use client";

import { usePathname } from "next/navigation";

import { TopBlur } from "@/components/EdgeBlur";

// Root-level placement prevents Safari from compositing separate backdrop
// samples for sticky headers and the top safe area.
export function MobileTopBlur() {
  const pathname = usePathname();
  const height = pathname.startsWith("/stock/")
    ? "calc(env(safe-area-inset-top) + 4.5rem)"
    : pathname === "/watchlist"
      ? "calc(env(safe-area-inset-top) + 5rem)"
      : "calc(env(safe-area-inset-top) + 7rem)";

  return <TopBlur height={height} className="lg:hidden" />;
}
