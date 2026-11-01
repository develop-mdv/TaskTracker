import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { Providers } from "@/components/providers/providers";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "TaskTracker — Личная Jira",
  description: "Персональный таск-трекер с канбан-досками, календарём и статистикой",
  applicationName: "TaskTracker",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TaskTracker" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#020617",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-200 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
