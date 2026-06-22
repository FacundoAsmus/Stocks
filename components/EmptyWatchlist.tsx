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
        /* ── GRADIENT ─────────────────────────────────────────────────────────
         * The trick: hue-rotate goes 0 → 230 → 460 (=0) in a single forward
         * direction with LINEAR timing. No ease-in-out = no dwell at ends.
         * The slide also runs linear so both loops are perfectly in sync
         * and there is zero pause anywhere in the cycle.
         * ──────────────────────────────────────────────────────────────────── */
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
            rgba(255, 48, 3, 0.38) 0%,
            transparent 70%
          );
          animation:
            wave-slide 8s  linear infinite,
            wave-color 8s  linear infinite;
          will-change: transform, filter;
        }

        /* Smooth pendulum slide — pre-baked sine curve at 10% steps */
        @keyframes wave-slide {
          0%   { transform: translateX(0%);     }
          10%  { transform: translateX(9.5%);   }
          20%  { transform: translateX(17.6%);  }
          30%  { transform: translateX(22.5%);  }
          40%  { transform: translateX(23%);    }
          50%  { transform: translateX(19%);    }
          60%  { transform: translateX(11.5%);  }
          70%  { transform: translateX(2%);     }
          80%  { transform: translateX(-6.5%);  }
          90%  { transform: translateX(-10.5%); }
          100% { transform: translateX(0%);     }
        }

        /* One full hue revolution forward: red(0) → green(115) → red(230≈0+230)
         * At 460 it wraps back to identical red so the loop is seamless.      */
        @keyframes wave-color {
          0%   { filter: hue-rotate(0deg)   brightness(1);    }
          50%  { filter: hue-rotate(230deg) brightness(1.18); }
          100% { filter: hue-rotate(460deg) brightness(1);    }
        }

        /* ── CANDLES ──────────────────────────────────────────────────────────
         * Fix for start-jerk: negative delay puts each candle already
         * mid-animation at its correct phase so there is NO jump on mount.
         * Using a single shared keyframe with ease-in-out gives the natural
         * breathe feel; the stagger is purely in the delay values.
         * ──────────────────────────────────────────────────────────────────── */
        @keyframes candle-breathe {
          0%, 100% { transform: scaleY(0.68); }
          50%       { transform: scaleY(1.32); }
        }
        @keyframes wick-breathe {
          0%, 100% { opacity: 0.28; transform: scaleY(0.75); }
          50%       { opacity: 1;   transform: scaleY(1.25); }
        }

        /* Negative delays = candles start already mid-cycle, never snap */
        .c-candle-1 { animation: candle-breathe 1.8s ease-in-out infinite -1.8s;   transform-origin: bottom; }
        .c-candle-2 { animation: candle-breathe 1.8s ease-in-out infinite -1.32s;  transform-origin: bottom; }
        .c-candle-3 { animation: candle-breathe 1.8s ease-in-out infinite -0.84s;  transform-origin: bottom; }
        .c-wick-1   { animation: wick-breathe   1.8s ease-in-out infinite -1.8s;   transform-origin: bottom; }
        .c-wick-2   { animation: wick-breathe   1.8s ease-in-out infinite -1.32s;  transform-origin: bottom; }
        .c-wick-3   { animation: wick-breathe   1.8s ease-in-out infinite -0.84s;  transform-origin: bottom; }
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
