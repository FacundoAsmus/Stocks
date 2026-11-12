"use client";

import { useEffect, useState } from "react";

/** Shared character reveal timing for AI generated text across the app. */
export function useTypingReveal(totalLength: number, resetKey: string, speed = 6) {
  const [progress, setProgress] = useState({ key: resetKey, visibleLength: 0 });
  const visibleLength = progress.key === resetKey ? progress.visibleLength : 0;
  const complete = visibleLength >= totalLength;

  useEffect(() => {
    setProgress({ key: resetKey, visibleLength: 0 });
    if (totalLength <= 0) return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current.key !== resetKey) return { key: resetKey, visibleLength: 1 };
        if (current.visibleLength >= totalLength) {
          window.clearInterval(timer);
          return current;
        }
        return { key: resetKey, visibleLength: Math.min(totalLength, current.visibleLength + 1) };
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [totalLength, resetKey, speed]);

  return { visibleLength, complete };
}

export function TextRevealCaret() {
  return <span aria-hidden className="text-reveal-caret" />;
}
