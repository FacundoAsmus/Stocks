"use client";

import Link from "next/link";
import { Earth, List } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Market", icon: Earth },
  { href: "/watchlist", label: "Watchlist", icon: List }
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4">
      {items.map((item) => {
        const Icon = item.icon;
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
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
