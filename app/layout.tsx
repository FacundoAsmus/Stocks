import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"] });

import { AppNav } from "@/components/AppNav";
import { MobileNav } from "@/components/MobileNav";
import { SearchBar } from "@/components/SearchBar";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Lens",
  description: "A stock news, watchlist, fundamentals, and analyst research starter app.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={dmSans.className}>
        <ToastProvider>
          <div className="min-h-screen">
            {/* Desktop header — hidden on mobile */}
            <header className="sticky top-0 z-40 border-b border-border-subtle/70 bg-background/86 backdrop-blur-xl hidden lg:block">
              <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                <AppNav />
                <SearchBar />
              </div>
            </header>

            <main className="w-full">{children}</main>

            {/* Mobile bottom tab bar */}
            <MobileNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
