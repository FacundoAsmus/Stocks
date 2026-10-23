"use client";

import { Newspaper } from "lucide-react";
import { useState } from "react";

export function NewsImage({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Newspaper className="h-8 w-8 text-text-muted opacity-40" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
