import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import SmoothScroll from "@/components/SmoothScroll";
import CustomCursor from "@/components/CustomCursor";

// Self-hosted (build sırasında indirilir) → render-blocking Google Fonts isteği yok.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Burak Koç — Portfolio",
  description: "Product designer and developer portfolio",
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Proje görselleri Firebase Storage'dan geliyor — bağlantıyı erkenden aç */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
          <CustomCursor />
        </ThemeProvider>
      </body>
    </html>
  );
}
