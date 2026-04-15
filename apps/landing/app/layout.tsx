import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  title: "Polyforge — Algorithmic Trading for Prediction Markets",
  description:
    "Build, backtest, and deploy automated trading strategies on prediction markets. Visual strategy builder, AI-powered signals, whale tracking, copy trading, advanced orders, and developer API.",
  keywords: [
    "prediction markets",
    "algorithmic trading",
    "strategy builder",
    "automated trading",
    "Polymarket",
    "trading bot",
    "copy trading",
    "whale tracking",
    "AI trading signals",
    "paper trading",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  metadataBase: new URL("https://polyforge.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://polyforge.app/",
    title: "Polyforge — Algorithmic Trading for Prediction Markets",
    description:
      "Build, backtest, and deploy automated trading strategies on prediction markets. Visual strategy builder, AI-powered signals, whale tracking, copy trading, advanced orders, and developer API.",
    siteName: "Polyforge",
    locale: "en_US",
    images: [
      {
        url: "https://polyforge.app/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@polyforge",
    title: "Polyforge — Algorithmic Trading for Prediction Markets",
    description:
      "Build, backtest, and deploy automated trading strategies on prediction markets. AI signals, whale tracking, copy trading.",
    images: ["https://polyforge.app/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Polyforge",
  url: "https://polyforge.app",
  description:
    "Algorithmic trading platform for prediction markets. Visual strategy builder, AI-powered signals, whale tracking, copy trading, advanced orders, and developer API.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Early access — free during beta",
  },
  featureList: [
    "Visual drag-and-drop strategy builder with 50+ blocks",
    "Paper trading and historical backtesting",
    "Live 24/7 automated execution",
    "Copy trading with whale mirroring",
    "AI-powered news analysis and trade signals",
    "Whale tracking and real-time alerts",
    "Advanced orders: TP/SL, trailing stops, limit, pegged",
    "Scoped developer API with REST endpoints",
    "Strategy import/export with .polyforge format",
    "Dark and light theme support",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
  try {
    if (localStorage.getItem('pf-theme') === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  } catch(e) {}
`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-pf-base text-pf-text font-sans antialiased min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:bg-pf-cyan-500 focus-visible:text-pf-text-contrast focus-visible:rounded-pf-sm focus-visible:text-sm focus-visible:font-semibold"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
