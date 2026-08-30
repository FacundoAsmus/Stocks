"use client";

// Small Client Component wrapper around the logo-with-fallback pattern.
// DesktopStockDetail.tsx (which renders this) is a Server Component, and
// Server Components can't attach event handlers (like onError) directly to
// a plain <img> — only actual Client Components can carry interactivity.
// Extracting just this bit into its own "use client" component lets the
// rest of the page stay server-rendered while this piece still gets to use
// onError for the graceful image-fails-to-load fallback.
export function StockLogo({
  logo,
  label,
  sizeClassName = "h-14 w-14"
}: {
  logo?: string;
  label: string;
  sizeClassName?: string;
}) {
  return (
    <>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className={`${sizeClassName} rounded-md border border-white/10 bg-white/5 object-contain`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <span
        className={`${sizeClassName} flex items-center justify-center rounded-md border border-border-subtle bg-panel-muted text-lg font-semibold text-text-primary ${logo ? "hidden" : ""}`}
      >
        {label}
      </span>
    </>
  );
}
