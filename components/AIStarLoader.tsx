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

function Star({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 1.75c.54 5.14 2.18 7.03 7.32 7.57-5.14.54-6.78 2.43-7.32 7.57-.54-5.14-2.18-7.03-7.32-7.57C9.82 8.78 11.46 6.89 12 1.75Z" />
    </svg>
  );
}

/**
 * The app's AI mark split into its two stars.  Each cycle swaps their
 * positions and sizes with a soft, non-linear motion, then rests for 200ms.
 */
export function AIStarLoader({ size = "md", className = "", label = "AI is thinking" }: AIStarLoaderProps) {
  return (
    <span className={`ai-star-loader ${sizes[size]} ${className}`} role="status" aria-label={label}>
      <Star className="ai-star-loader__star ai-star-loader__star--large" />
      <Star className="ai-star-loader__star ai-star-loader__star--small" />
    </span>
  );
}
