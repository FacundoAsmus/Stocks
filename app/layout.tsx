import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Lens",
  description: "Stock analysis and watchlist tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "transparent" },
    { media: "(prefers-color-scheme: dark)", color: "transparent" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary antialiased min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}