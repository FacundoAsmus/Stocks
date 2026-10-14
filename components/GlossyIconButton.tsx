"use client";

import type { CSSProperties, ReactNode } from "react";

type GlossyIconButtonProps = {
  "aria-label": string;
  onClick: () => void;
  size?: number;
  ringColor?: string;
  faceColor?: string;
  children?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
};

type GlossyStyle = CSSProperties & {
  "--d": string;
  "--gib-ring-color": string;
  "--gib-face-color": string;
};

export function GlossyIconButton({
  "aria-label": ariaLabel,
  onClick,
  size = 36,
  ringColor = "#397d08",
  faceColor = "#adfa1b",
  children,
  className,
  type = "button",
}: GlossyIconButtonProps) {
  const style: GlossyStyle = {
    "--d": `${size}px`,
    "--gib-ring-color": ringColor,
    "--gib-face-color": faceColor,
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      className={["glossy-icon-button", className].filter(Boolean).join(" ")}
      style={style}
    >
      <span className="glossy-icon-button__face" aria-hidden="true">
        <span className="glossy-icon-button__icon">
          {children ?? (
            <svg viewBox="0 0 100 100" fill="none">
              <path d="M50 65.6V34.7M36.8 47.9L50 34.7L63.2 47.9" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

export function GlossyCloseIcon() {
  return (
    <svg className="glossy-icon-button__close-icon" viewBox="0 0 100 100" fill="none">
      <path d="M37 37L63 63M63 37L37 63" />
    </svg>
  );
}
