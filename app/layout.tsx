import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"] });

import { MobileNav } from "@/components/MobileNav";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/ToastProvider";
import { BottomBlur } from "@/components/EdgeBlur";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wave form",
  description: "A stock news, watchlist, fundamentals, and analyst research starter app.",
};

// `viewport-fit=cover` must be emitted through Next's viewport export. It
// lets the document and fixed top blur extend beneath the iPhone status bar.
// No `themeColor` here: setting one makes Safari paint its own translucent
// status-bar/toolbar chrome on top of everything, which showed up as a
// separate solid/blurred bar layered above our own gradient blur.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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

            {/* Progressive blur so content fades out before disappearing
                under the floating mobile nav pill / bottom edge, on every page.
                (The top blur is page-specific — each page's own sticky header
                renders its own HeaderTopBlur, since header heights differ per page.) */}
            <BottomBlur />

            {/* Mobile bottom tab bar */}
            <MobileNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
