"use client";

import Link from "next/link";
import { List } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M4.5 7.5 Q12 6 19.5 7.5" />
      <path d="M4.5 16.5 Q12 18 19.5 16.5" />
      <path d="M12 3 Q6.5 12 12 21" />
      <path d="M12 3 Q17.5 12 12 21" />
    </svg>
  );
}

const items = [
  { href: "/", label: "Market", icon: "globe" as const },
  { href: "/watchlist", label: "Watchlist", icon: "list" as const }
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4">
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-2 text-base font-semibold text-text-primary transition-all duration-200 hover:-translate-y-1 hover:scale-[1.04]"
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-200",
                isActive
                  ? "border-positive bg-positive text-black"
                  : "border-positive/30 bg-positive/10 text-positive group-hover:border-positive/60"
              )}
            >
              {item.icon === "globe"
                ? <GlobeIcon className="h-5 w-5" />
                : <List className="h-5 w-5" aria-hidden />
              }
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
