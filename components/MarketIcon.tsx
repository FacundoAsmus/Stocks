type MarketIconProps = {
  icon?: string;
  className: string;
};

export function MarketIcon({ icon = "general_icon.svg", className }: MarketIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-white/5 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/market-icons/${icon}`} alt="" className="h-full w-full object-contain" />
    </span>
  );
}
