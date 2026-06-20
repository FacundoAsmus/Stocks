export function EmptyWatchlist({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <LoadingScreen />;

  return (
    <section className="rounded-md border border-dashed border-border-subtle bg-panel/70 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-panel-muted text-positive">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-text-primary">Your watchlist is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
        Search for a company or ticker above, open its detail page, and add it to your watchlist.
      </p>
    </section>
  );
}

export function LoadingScreen({ label = "Loading your watchlist" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden">
      <style>{`
        /*
         * GRADIENT: a wide ellipse always anchored to the bottom.
         * We animate a pseudoelement that is 300% wide so we can
         * slide it left→right without it ever leaving the bottom edge.
         * Color cycles red → green → red via a separate filter animation.
         */
        .loading-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .loading-bg::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: -100%;
          width: 300%;
          height: 100%;
          background: radial-gradient(
            ellipse 55% 42% at 50% 100%,
            rgba(255, 48, 3, 0.35) 0%,
            transparent 70%
          );
          animation:
            wave-slide  6s  ease-in-out infinite,
            wave-color  6s  ease-in-out infinite;
          will-change: transform, filter;
        }

        /* Slide the 300%-wide element so the hot-spot drifts right then left */
        @keyframes wave-slide {
          0%   { transform: translateX(0%);   }
          50%  { transform: translateX(33%);  }
          100% { transform: translateX(0%);   }
        }

        /* Hue-rotate the red glow to green and back — buttery smooth */
        @keyframes wave-color {
          0%   { filter: hue-rotate(0deg)   brightness(1);    }
          50%  { filter: hue-rotate(115deg) brightness(1.15); }
          100% { filter: hue-rotate(0deg)   brightness(1);    }
        }

        /* CANDLES: scale from the bottom, staggered left→right */
        @keyframes candle-scale {
          0%, 100% { transform: scaleY(0.7);  }
          50%       { transform: scaleY(1.3);  }
        }
        @keyframes wick-fade {
          0%, 100% { opacity: 0.35; transform: scaleY(0.8); }
          50%       { opacity: 1;   transform: scaleY(1.2); }
        }
        .c-candle-1 { animation: candle-scale 1.3s ease-in-out infinite 0s;    transform-origin: bottom; }
        .c-candle-2 { animation: candle-scale 1.3s ease-in-out infinite 0.22s; transform-origin: bottom; }
        .c-candle-3 { animation: candle-scale 1.3s ease-in-out infinite 0.44s; transform-origin: bottom; }
        .c-wick-1   { animation: wick-fade    1.3s ease-in-out infinite 0s;    transform-origin: bottom; }
        .c-wick-2   { animation: wick-fade    1.3s ease-in-out infinite 0.22s; transform-origin: bottom; }
        .c-wick-3   { animation: wick-fade    1.3s ease-in-out infinite 0.44s; transform-origin: bottom; }
      `}</style>

      <div className="loading-bg" />

      {/* Candles — ascending: shortest left, tallest right */}
      <div className="relative flex items-end justify-center gap-[7px] h-20">
        <div className="flex flex-col items-center gap-[3px]">
          <div className="c-wick-1 w-[2px] h-2 rounded-full bg-positive/60" />
          <div className="c-candle-1 w-5 h-6 rounded-sm bg-positive/60" />
        </div>
        <div className="flex flex-col items-center gap-[3px]">
          <div className="c-wick-2 w-[2px] h-3 rounded-full bg-positive/80" />
          <div className="c-candle-2 w-5 h-10 rounded-sm bg-positive/80" />
        </div>
        <div className="flex flex-col items-center gap-[3px]">
          <div className="c-wick-3 w-[2px] h-4 rounded-full bg-positive" />
          <div className="c-candle-3 w-5 h-14 rounded-sm bg-positive" />
        </div>
      </div>

      <p className="relative text-lg font-semibold text-text-primary tracking-tight">{label}</p>
    </div>
  );
}

export function CandleLoader() {
  return <LoadingScreen />;
}
