type MarketIconProps = {
  icon?: string;
  className: string;
};

export function MarketIcon({ icon = "general_icon.svg", className }: MarketIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/market-icons/${icon}`}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}
