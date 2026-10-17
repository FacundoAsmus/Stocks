const lastSparklineDataBySymbol = new Map<string, string>();
const activeRevealByElement = new WeakMap<HTMLElement, Animation>();

/**
 * Reveal a small stock chart only when its underlying data signature changes.
 * Keeping the last signature by symbol prevents row moves/remounts during
 * watchlist reordering from replaying the animation.
 */
export function revealSparklineOnDataChange(element: HTMLElement | null, symbol: string, dataKey: string) {
  if (!element) return;

  const previousDataKey = lastSparklineDataBySymbol.get(symbol);
  lastSparklineDataBySymbol.set(symbol, dataKey);
  if (previousDataKey === dataKey) return;

  activeRevealByElement.get(element)?.cancel();
  const animation = element.animate(
    [
      { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0 0 0)" },
    ],
    {
      duration: 700,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "both",
    }
  );
  activeRevealByElement.set(element, animation);
}
