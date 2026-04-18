export interface MarketTick {
  sym: string;
  px: number;
  chg: number;
  vol: string;
}

export const MARKETS: MarketTick[] = [
  { sym: "ELEC28·YES", px: 0.42, chg: +2.4, vol: "$1.2M" },
  { sym: "BTC>150K·YES", px: 0.31, chg: -1.1, vol: "$840K" },
  { sym: "FED-CUT-JUL·YES", px: 0.73, chg: +4.2, vol: "$620K" },
  { sym: "SBX-WIN·NO", px: 0.18, chg: -0.8, vol: "$410K" },
  { sym: "ETH-ETF·YES", px: 0.88, chg: +0.6, vol: "$2.1M" },
  { sym: "CPI<3·YES", px: 0.55, chg: +1.9, vol: "$320K" },
  { sym: "OSCAR-BP·YES", px: 0.26, chg: -3.1, vol: "$180K" },
  { sym: "GDP-Q2>2·YES", px: 0.61, chg: +0.4, vol: "$510K" },
  { sym: "NBA-FINALS·YES", px: 0.39, chg: +2.7, vol: "$890K" },
  { sym: "NVDA-BEAT·YES", px: 0.81, chg: +1.2, vol: "$1.4M" },
  { sym: "AI-GPT5-Q3·NO", px: 0.47, chg: -2.3, vol: "$240K" },
  { sym: "MIDTERMS-GOP·YES", px: 0.52, chg: -0.2, vol: "$700K" },
];

export const DASHBOARD_MARKETS: MarketTick[] = [
  { sym: "US Election 2028", vol: "$1.2M", px: 0.42, chg: +2.4 },
  { sym: "BTC > $150k by Dec", vol: "$840K", px: 0.31, chg: -1.1 },
  { sym: "Fed Rate Cut · Jul", vol: "$620K", px: 0.73, chg: +4.2 },
  { sym: "ETH Spot ETF · Q2", vol: "$2.1M", px: 0.88, chg: +0.6 },
  { sym: "NVDA Earnings Beat", vol: "$1.4M", px: 0.81, chg: +1.2 },
];

export type HeroVariant = "terminal" | "typography" | "builder";

export const HEADLINES: Record<
  HeroVariant,
  { h: string; hEm: string; sub: string }
> = {
  terminal: {
    h: "The trading terminal for ",
    hEm: "prediction markets.",
    sub: "Build automated strategies, track whale activity, and backtest your edge on Polymarket — without writing a single line of code.",
  },
  typography: {
    h: "Forge an edge. ",
    hEm: "Then automate it.",
    sub: "36 blocks. Visual canvas. Paper mode. Live execution. One terminal for everything Polymarket.",
  },
  builder: {
    h: "Drag, wire, ",
    hEm: "deploy.",
    sub: "A visual strategy builder with real primitives — triggers, conditions, actions, safety. Backtested on Polymarket's full history, live in ≤ 200ms.",
  },
};

export const TRUST_ITEMS = [
  {
    icon: "key" as const,
    title: "Self-custodial",
    desc: "Your Polymarket credentials — imported, never generated. You keep full control.",
  },
  {
    icon: "lock" as const,
    title: "AES-256 encryption",
    desc: "Envelope encryption with keys in AWS Secrets Manager. Quarterly rotation.",
  },
  {
    icon: "shield" as const,
    title: "Isolated signer",
    desc: "Zero public exposure. Every trade signed in a locked-down service.",
  },
  {
    icon: "check" as const,
    title: "Open APIs",
    desc: "OpenAPI 3.1 spec, HMAC webhooks, TOTP 2FA, JWT auth. No cookies.",
  },
] as const;

export const METRICS = [
  { value: "12,400+", label: "Traders building" },
  { value: "847", label: "Live strategies" },
  { value: "$2.3M", label: "Monthly volume" },
  { value: "200ms", label: "Median tick latency" },
] as const;
