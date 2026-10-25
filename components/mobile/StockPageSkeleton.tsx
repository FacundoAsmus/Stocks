export function StockPageSkeleton() {
  return (
    <div className="min-h-screen pb-36" aria-hidden="true">
      <div style={{ height: "calc(4rem + env(safe-area-inset-top))" }} />

      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <div className="h-12 w-12 shrink-0 rounded-full bg-panel-muted" />
        <div className="h-5 max-w-56 flex-1 rounded-full bg-panel-muted" />
        <div className="h-10 w-10 shrink-0 rounded-full bg-panel-muted" />
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="mb-3 h-10 w-48 rounded-lg bg-panel-muted" />
        <div className="h-3 w-28 rounded-full bg-panel-muted/70" />
      </div>

      <div className="px-2">
        <div className="h-[260px] rounded-2xl bg-panel-muted/45" />
        <div className="mx-auto mt-4 h-10 w-64 max-w-full rounded-full border border-border-subtle bg-panel-muted/45" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-2 px-7">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="py-4">
            <div className="mb-3 h-3 w-20 rounded-full bg-panel-muted/70" />
            <div className="h-6 w-24 max-w-full rounded-md bg-panel-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
