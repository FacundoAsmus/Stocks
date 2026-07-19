import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"] });

import { MobileNav } from "@/components/MobileNav";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wave form",
  description: "A stock news, watchlist, fundamentals, and analyst research starter app.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={dmSans.className}>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('theme') || 'dark';
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var isDark = t === 'dark' || (t === 'system' && prefersDark);
            if (!isDark) document.documentElement.classList.add('light-mode');
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', isDark ? '#000000' : '#ffffff');
          })();
        `}} />
        <ToastProvider>
          <div className="min-h-screen">
            {/* Desktop header — hidden on mobile */}
            <SiteHeader />

            <main className="w-full">{children}</main>

            {/* Mobile bottom tab bar */}
            <MobileNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
