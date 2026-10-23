import { useId } from "react";

type AIStarLoaderProps = {
  /** Visual scale only; the animation stays identical in every context. */
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const sizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10",
};

function Star({ className, gradientId }: { className: string; gradientId: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={`url(#${gradientId})`} stroke={`url(#${gradientId})`} strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--ai-iris-cyan)" />
          <stop offset="20%" stopColor="var(--ai-iris-blue)" />
          <stop offset="40%" stopColor="var(--ai-iris-violet)" />
          <stop offset="60%" stopColor="var(--ai-iris-pink)" />
          <stop offset="80%" stopColor="var(--ai-iris-peach)" />
          <stop offset="100%" stopColor="var(--ai-iris-mint)" />
        </linearGradient>
      </defs>
      <path d="M12 1.75c.54 5.14 2.18 7.03 7.32 7.57-5.14.54-6.78 2.43-7.32 7.57-.54-5.14-2.18-7.03-7.32-7.57C9.82 8.78 11.46 6.89 12 1.75Z" />
    </svg>
  );
}

/** The two iridescent stars move only while this thinking indicator is mounted. */
export function AIStarLoader({ size = "md", className = "", label = "AI is thinking" }: AIStarLoaderProps) {
  const gradientId = `ai-star-${useId().replace(/:/g, "")}`;
  return (
    <span className={`ai-star-loader ${sizes[size]} ${className}`} role="status" aria-label={label}>
      <Star gradientId={`${gradientId}-large`} className="ai-star-loader__star ai-star-loader__star--large" />
      <Star gradientId={`${gradientId}-small`} className="ai-star-loader__star ai-star-loader__star--small" />
    </span>
  );
}
