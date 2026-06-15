import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "./navbar";
import { ScrollToTop } from "./components/scroll_to_top";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "La Paletixa SaaS",
  description: "SaaS Platform for decoupled multi-tenant client operations",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html
        lang="es"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <Script
            id="theme-bootstrap"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var theme = localStorage.getItem('theme') || 'dark';
                    if (theme === 'dark') {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        </head>
      <body className="h-full pwa-safe-area-bg">
        <Providers>
          <div className="pwa-standalone-shell flex h-dvh flex-col overflow-hidden">
            <Navbar />
            <div className="pwa-safe-scroll flex-1 overflow-hidden">
              {children}
            </div>
          </div>
          <ScrollToTop />
        </Providers>
      </body>
    </html>
  );
}
