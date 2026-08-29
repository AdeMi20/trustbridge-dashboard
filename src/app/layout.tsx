import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/Providers";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "TrustBridge Dashboard",
    template: "%s | TrustBridge",
  },
  description:
    "Register your Stellar address for TrustBridge Wave payouts. Maintainers track contributor readiness across GitHub and Stellar.",
  keywords: [
    "TrustBridge",
    "Stellar",
    "USDC",
    "open source",
    "contributor payouts",
    "GitHub",
  ],
  openGraph: {
    title: "TrustBridge Dashboard",
    description:
      "GitHub → Stellar address mapping with live trustline validation for Wave payouts.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen`}>
        {/*
          First focusable thing on every page. Visually hidden until it takes
          focus, at which point it has to be a real, readable control — a skip
          link that stays invisible while focused is worse than none, because
          the keyboard user has no idea where they are.
        */}
        <a
          href="#main-content"
          data-testid="skip-to-main"
          className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
