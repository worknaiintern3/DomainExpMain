import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const jakarta = localFont({
  src: "./fonts/jakarta-latin.woff2",
  variable: "--font-jakarta",
  weight: "600 800",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains-mono",
  weight: "500",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "DomainPulse — Infrastructure & Domain Portfolio Manager",
    template: "%s · DomainPulse",
  },
  description:
    "Map domains, servers, apps, and accounts in one workspace. Count down every expiry and compare live registrar renewal truth — no guessed data.",
  keywords: [
    "domain portfolio manager",
    "domain expiry monitoring",
    "registrar price comparison",
    "DNS SSL RDAP",
    "infrastructure map",
  ],
  openGraph: {
    type: "website",
    url: "/",
    title: "DomainPulse — Infrastructure & Domain Portfolio Manager",
    description:
      "Every domain, server, and renewal in one pulse. Stored records plus live checks — renewals stay with your registrars.",
    siteName: "DomainPulse",
  },
  twitter: {
    card: "summary_large_image",
    title: "DomainPulse — Infrastructure & Domain Portfolio Manager",
    description:
      "Expiry countdowns, live registrar renewal truth, and domain-to-server mapping. Missing data shown as “—”, never guessed.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F8FAFC",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-primary"
        >
          Skip to content
        </a>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <Navbar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
