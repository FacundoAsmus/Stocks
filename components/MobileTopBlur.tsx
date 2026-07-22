"use client";

// Disabled: this used to render a fixed blur (TopBlur, from EdgeBlur) over
// the status-bar/dynamic-island area on every page, hiding whatever content
// scrolled underneath it. Now a no-op so that area is left fully
// transparent and shows whatever the page is actually scrolling behind it.
// EdgeBlur.tsx itself is untouched — it's still used elsewhere.
export function MobileTopBlur() {
  return null;
}
