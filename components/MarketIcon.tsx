type MarketIconProps = {
  icon?: string;
  className: string;
};

export function MarketIcon({ icon = "general_icon.svg", className }: MarketIconProps) {
  const shouldStartHidden = className.split(/\s+/).includes("hidden");
  const frameClassName = className.split(/\s+/).filter((token) => token !== "hidden").join(" ");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 ${frameClassName}`}
      style={{ display: shouldStartHidden ? "none" : "inline-flex", borderRadius: "50%", backgroundColor: "#000000" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/market-icons/${icon}`} alt="" className="h-[72%] w-[72%] object-contain" />
    </span>
  );
}
