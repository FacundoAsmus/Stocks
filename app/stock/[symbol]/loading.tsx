export default function StockLoading() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-md border border-border-subtle bg-panel" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-80 animate-pulse rounded-md border border-border-subtle bg-panel md:col-span-2" />
        <div className="h-80 animate-pulse rounded-md border border-border-subtle bg-panel" />
      </div>
    </div>
  );
}
