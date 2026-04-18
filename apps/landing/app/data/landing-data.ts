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

export interface WhaleTrade {
  wallet: string;
  init: string;
  market: string;
  side: "bought" | "sold";
  px: string;
  size: string;
  t: string;
  tone: "gain" | "loss";
}

export const WHALES: WhaleTrade[] = [
  { wallet: "0x8f··3a", init: "8F", market: "US Elections 2028 · YES", side: "bought", px: "0.42", size: "$52,000", t: "2m", tone: "gain" },
  { wallet: "0xd4··b7", init: "D4", market: "BTC > $150k by Dec · NO", side: "sold", px: "0.31", size: "$31,000", t: "5m", tone: "loss" },
  { wallet: "0xa1··9c", init: "A1", market: "Fed Rate Cut Jul · YES", side: "bought", px: "0.73", size: "$88,000", t: "8m", tone: "gain" },
  { wallet: "0x21··ef", init: "21", market: "Oscar Best Picture · YES", side: "bought", px: "0.26", size: "$18,400", t: "12m", tone: "gain" },
  { wallet: "0xbc··04", init: "BC", market: "NBA Finals MVP · YES", side: "sold", px: "0.39", size: "$24,700", t: "18m", tone: "loss" },
];

export const BUILDER_CATEGORIES = [
  { label: "Triggers", count: "13", sub: "event + tick", color: "var(--accent-text)" },
  { label: "Conditions", count: "9", sub: "liquidity · limits · windows", color: "var(--color-purple-400)" },
  { label: "Actions", count: "8", sub: "GTC · FOK · stops · scales", color: "var(--gain-text)" },
  { label: "Safety", count: "6", sub: "circuit breakers", color: "var(--warning)" },
] as const;

export const BACKTEST_STATS = [
  { label: "Sharpe", value: "1.84", color: "text-accent-text" },
  { label: "Max DD", value: "-8.2%", color: "text-loss" },
  { label: "Win rate", value: "67.2%", color: "text-gain" },
  { label: "Trades", value: "212", color: "text-primary" },
] as const;

export const STRATEGY_LINES = [
  { name: "momentum α3", color: "var(--accent-default)" },
  { name: "mean-reversion", color: "var(--gain)" },
  { name: "news-reactive", color: "var(--warning)" },
  { name: "control", color: "var(--loss)" },
] as const;

export const PNL_CATEGORIES = [
  { category: "Politics", pct: 62, tone: "gain" as const },
  { category: "Crypto", pct: 38, tone: "gain" as const },
  { category: "Sports", pct: -14, tone: "loss" as const },
  { category: "Macro", pct: 22, tone: "gain" as const },
  { category: "Culture", pct: -6, tone: "loss" as const },
];

export const BRACKET_ORDERS = [
  { label: "Entry", value: "BUY 1,500 @ 0.31", status: "filled", color: "var(--gain-text)" },
  { label: "Take-profit", value: "SELL 1,500 @ 0.42", status: "working", color: "var(--accent-text)" },
  { label: "Stop-loss", value: "SELL 1,500 @ 0.27", status: "working", color: "var(--warning)" },
] as const;

export const BRACKET_STATS = [
  { label: "Max gain", value: "+$165", color: "var(--gain-text)" },
  { label: "Max loss", value: "-$60", color: "var(--loss-text)" },
  { label: "R:R", value: "2.75", color: "var(--accent-text)" },
] as const;
