"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function ThemeSiteLogo() {
  const [isLightMode, setIsLightMode] = useState(false);
  const [darkLogoUnavailable, setDarkLogoUnavailable] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsLightMode(root.classList.contains("light-mode"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => setDarkLogoUnavailable(false), [isLightMode]);

  return (
    <Image
      src={isLightMode || darkLogoUnavailable ? "/icons/site-logo.png" : "/icons/site-logo-dark.png"}
      alt=""
      width={80}
      height={40}
      className="h-10 w-20 shrink-0 rounded-3xl object-contain"
      onError={() => { if (!isLightMode) setDarkLogoUnavailable(true); }}
    />
  );
}
