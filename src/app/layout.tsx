import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";
import { MobileNavProvider } from "@/components/MobileNav";
import { SITE_URL } from "@/lib/siteConfig";

// Self-hosted (build sırasında indirilir) → render-blocking Google Fonts isteği yok.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Burak Koç — Portfolio", template: "%s | Burak Koç" },
  description: "Product designer and developer portfolio",
  openGraph: { siteName: "Burak Koç", locale: "tr_TR", type: "website" },
};

// Pinch-zoom stays on (a page's small captions must be readable — WCAG 1.4.4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * İlk boyamadan önce tema attribute'unu yazar → dark modda açık tema flash'ı olmaz.
 */
const themeScript = `try{var t=localStorage.getItem("theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Proje görselleri Firebase Storage'dan geliyor — bağlantıyı erkenden aç (görseller CORS'suz yüklenir: crossOrigin'siz) */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
        {/* Before the first paint (no light-theme flash in dark mode) — as next/script's, React keeps it out of what it draws. */}
        <Script id="theme" strategy="beforeInteractive">{themeScript}</Script>
      </head>
      <body>
        <ThemeProvider>
          <MobileNavProvider>
            <SmoothScroll>
              {children}
            </SmoothScroll>
            <CustomCursor />
          </MobileNavProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
