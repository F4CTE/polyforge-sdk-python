import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Polyforge — Algorithmic Trading for Prediction Markets',
  description:
    'Build, backtest, and deploy automated trading strategies on prediction markets. No-code strategy builder, live execution, real-time analytics.',
  keywords: [
    'prediction markets',
    'algorithmic trading',
    'strategy builder',
    'automated trading',
    'Polymarket',
    'trading bot',
  ],
  metadataBase: new URL('https://polyforge.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://polyforge.app/',
    title: 'Polyforge — Algorithmic Trading for Prediction Markets',
    description:
      'Build, backtest, and deploy automated trading strategies on prediction markets. No-code strategy builder, live execution, real-time analytics.',
    siteName: 'Polyforge',
    locale: 'en_US',
    images: [
      {
        url: 'https://polyforge.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@polyforge',
    title: 'Polyforge — Algorithmic Trading for Prediction Markets',
    description:
      'Build, backtest, and deploy automated trading strategies on prediction markets.',
    images: ['https://polyforge.app/og-image.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Polyforge',
  url: 'https://polyforge.app',
  description:
    'Algorithmic trading platform for prediction markets. Build, backtest, and deploy automated strategies with a no-code builder.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Early access — free during beta',
  },
  featureList: [
    'No-code strategy builder',
    'Historical backtesting',
    'Live automated execution',
    'Real-time market data',
    'Strategy discovery and community sharing',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-pf-base text-pf-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
