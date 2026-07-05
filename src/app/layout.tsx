import type { Metadata, Viewport } from "next";
import { TargetPageTracker } from "@/components/TargetPageTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "نظام تتبع المهام",
  description: "تتبع داخلي للمهام والنقرات مع GA4 و Search Console",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "تتبع المهام",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <TargetPageTracker />
      </body>
    </html>
  );
}
