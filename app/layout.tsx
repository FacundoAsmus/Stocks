import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"] });

import { SearchBar } from "@/components/SearchBar";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Lens",
  description: "A stock news, watchlist, fundamentals, and analyst research starter app."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={dmSans.className}>
        <ToastProvider>
          <div className="min-h-screen">
            <header className="sticky top-0 z-40 border-b border-border-subtle/70 bg-background/86 backdrop-blur-xl">
              <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
                <Link href="/" className="flex items-center gap-3 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.04]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-positive/30 bg-positive/10 text-positive">
                    <Home className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-base font-semibold tracking-normal text-text-primary">
                      Home
                    </span>
                    <span className="block text-xs text-text-muted">News and fundamentals</span>
                  </span>
                </Link>
                <SearchBar />
              </div>
            </header>
            <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
