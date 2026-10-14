"use client";

import type { CSSProperties, ReactNode } from "react";

type GlossyIconButtonProps = {
  "aria-label": string;
  onClick: () => void;
  size?: number;
  children?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
};

type GlossyStyle = CSSProperties & {
  "--d": string;
};

export function GlossyIconButton({
  "aria-label": ariaLabel,
  onClick,
  size = 36,
  children,
  className,
  type = "button",
}: GlossyIconButtonProps) {
  const style: GlossyStyle = { "--d": `${size}px` };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      className={["glossy-icon-button", className].filter(Boolean).join(" ")}
      style={style}
    >
      <span className="glossy-icon-button__icon" aria-hidden="true">
        {children ?? (
          <svg viewBox="0 0 100 100" fill="none">
            <path d="M50 65.6V34.7M36.8 47.9L50 34.7L63.2 47.9" />
          </svg>
        )}
      </span>
    </button>
  );
}

export function GlossyCloseIcon() {
  return (
    <svg className="glossy-icon-button__close-icon" viewBox="0 0 24 24" fill="none">
      <path d="M5 5L19 19M19 5L5 19" />
    </svg>
  );
}
