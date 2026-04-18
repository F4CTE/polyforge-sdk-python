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
  {
    wallet: "0x8f··3a",
    init: "8F",
    market: "US Elections 2028 · YES",
    side: "bought",
    px: "0.42",
    size: "$52,000",
    t: "2m",
    tone: "gain",
  },
  {
    wallet: "0xd4··b7",
    init: "D4",
    market: "BTC > $150k by Dec · NO",
    side: "sold",
    px: "0.31",
    size: "$31,000",
    t: "5m",
    tone: "loss",
  },
  {
    wallet: "0xa1··9c",
    init: "A1",
    market: "Fed Rate Cut Jul · YES",
    side: "bought",
    px: "0.73",
    size: "$88,000",
    t: "8m",
    tone: "gain",
  },
  {
    wallet: "0x21··ef",
    init: "21",
    market: "Oscar Best Picture · YES",
    side: "bought",
    px: "0.26",
    size: "$18,400",
    t: "12m",
    tone: "gain",
  },
  {
    wallet: "0xbc··04",
    init: "BC",
    market: "NBA Finals MVP · YES",
    side: "sold",
    px: "0.39",
    size: "$24,700",
    t: "18m",
    tone: "loss",
  },
];

export const BUILDER_CATEGORIES = [
  {
    label: "Triggers",
    count: "13",
    sub: "event + tick",
    color: "var(--accent-text)",
  },
  {
    label: "Conditions",
    count: "9",
    sub: "liquidity · limits · windows",
    color: "var(--color-purple-400)",
  },
  {
    label: "Actions",
    count: "8",
    sub: "GTC · FOK · stops · scales",
    color: "var(--gain-text)",
  },
  {
    label: "Safety",
    count: "6",
    sub: "circuit breakers",
    color: "var(--warning)",
  },
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
  {
    label: "Entry",
    value: "BUY 1,500 @ 0.31",
    status: "filled",
    color: "var(--gain-text)",
  },
  {
    label: "Take-profit",
    value: "SELL 1,500 @ 0.42",
    status: "working",
    color: "var(--accent-text)",
  },
  {
    label: "Stop-loss",
    value: "SELL 1,500 @ 0.27",
    status: "working",
    color: "var(--warning)",
  },
] as const;

export const BRACKET_STATS = [
  { label: "Max gain", value: "+$165", color: "var(--gain-text)" },
  { label: "Max loss", value: "-$60", color: "var(--loss-text)" },
  { label: "R:R", value: "2.75", color: "var(--accent-text)" },
] as const;

export interface Block {
  cat: "trigger" | "condition" | "action" | "safety";
  name: string;
  desc: string;
}

export const BLOCKS: Block[] = [
  {
    cat: "trigger",
    name: "new_bet_opens",
    desc: "Fires when a new market opens in a series",
  },
  {
    cat: "trigger",
    name: "price_crosses_up",
    desc: "Token price crosses threshold upward",
  },
  {
    cat: "trigger",
    name: "price_crosses_down",
    desc: "Token price crosses threshold downward",
  },
  {
    cat: "trigger",
    name: "time_before_close",
    desc: "Fires N minutes before market close",
  },
  {
    cat: "trigger",
    name: "win_streak",
    desc: "Fires after N consecutive wins",
  },
  {
    cat: "trigger",
    name: "loss_streak",
    desc: "Fires after N consecutive losses",
  },
  {
    cat: "trigger",
    name: "price_above_tick",
    desc: "Price is above a threshold on tick",
  },
  {
    cat: "trigger",
    name: "price_below_tick",
    desc: "Price is below a threshold on tick",
  },
  {
    cat: "trigger",
    name: "spread_below_tick",
    desc: "Book spread below max on tick",
  },
  {
    cat: "trigger",
    name: "volume_rate_tick",
    desc: "Volume rate above threshold",
  },
  {
    cat: "trigger",
    name: "price_momentum_tick",
    desc: "Directional momentum on tick",
  },
  { cat: "trigger", name: "rsi_threshold_tick", desc: "RSI crosses level N" },
  { cat: "trigger", name: "every_tick", desc: "Fires every tick" },
  {
    cat: "condition",
    name: "min_liquidity",
    desc: "Order book liquidity ≥ USDC",
  },
  { cat: "condition", name: "max_position", desc: "Cap position size in USDC" },
  { cat: "condition", name: "max_bets_per_day", desc: "Cap trades per day" },
  { cat: "condition", name: "daily_loss_limit", desc: "Daily USDC loss cap" },
  {
    cat: "condition",
    name: "cooldown_after_trade",
    desc: "Wait Nms after a trade",
  },
  {
    cat: "condition",
    name: "price_in_range",
    desc: "Price within min/max bounds",
  },
  { cat: "condition", name: "no_reentry", desc: "Skip markets traded today" },
  {
    cat: "condition",
    name: "no_existing_position",
    desc: "Skip if already holding",
  },
  { cat: "condition", name: "time_window", desc: "Trade only within hours" },
  {
    cat: "action",
    name: "buy_yes",
    desc: "Place buy on YES — GTC / GTD / FOK",
  },
  { cat: "action", name: "buy_no", desc: "Place buy on NO — GTC / GTD / FOK" },
  { cat: "action", name: "set_stop_loss", desc: "Attach stop-loss at N%" },
  { cat: "action", name: "take_profit", desc: "Attach take-profit at N%" },
  { cat: "action", name: "scale_in", desc: "Add size to current position" },
  { cat: "action", name: "scale_out", desc: "Reduce size on current position" },
  {
    cat: "action",
    name: "cancel_all_orders",
    desc: "Cancel open orders on market",
  },
  { cat: "action", name: "skip_bet", desc: "Explicitly skip a tick" },
  {
    cat: "safety",
    name: "stop_if_daily_loss",
    desc: "Halt at daily USDC loss",
  },
  {
    cat: "safety",
    name: "stop_if_orders_per_min",
    desc: "Halt on order rate breach",
  },
  {
    cat: "safety",
    name: "stop_if_consecutive_loss",
    desc: "Halt on N straight losses",
  },
  {
    cat: "safety",
    name: "stop_if_exposure_exceeds",
    desc: "Cap total USDC exposure",
  },
  { cat: "safety", name: "pause_after_fill", desc: "Pause Nms after a fill" },
  { cat: "safety", name: "max_orders_total", desc: "Halt at N total orders" },
];

export interface RegistryGroup {
  key: Block["cat"];
  label: string;
  hint: string;
  color: string;
  sample: string[];
}

export const REGISTRY_GROUPS: RegistryGroup[] = [
  {
    key: "trigger",
    label: "Triggers",
    hint: "event + tick",
    color: "var(--accent-text)",
    sample: ["price_crosses_up", "volume_rate_tick", "time_before_close"],
  },
  {
    key: "condition",
    label: "Conditions",
    hint: "liquidity · limits · windows",
    color: "var(--color-purple-400)",
    sample: ["min_liquidity", "max_position", "time_window"],
  },
  {
    key: "action",
    label: "Actions",
    hint: "GTC · FOK · stops · scales",
    color: "var(--gain-text)",
    sample: ["buy_yes", "set_stop_loss", "scale_out"],
  },
  {
    key: "safety",
    label: "Safety",
    hint: "circuit breakers",
    color: "var(--warning)",
    sample: [
      "stop_if_daily_loss",
      "stop_if_consecutive_loss",
      "pause_after_fill",
    ],
  },
];

export interface Testimonial {
  who: string;
  role: string;
  quote: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    who: "Alex K.",
    role: "Quant, ex-Jane Street",
    quote:
      "The block registry is the cleanest IF/THEN I've used outside of our internal tooling. Paper mode → live in one click.",
  },
  {
    who: "Sarah R.",
    role: "Discretionary trader",
    quote:
      "I mirror two whale wallets with Kelly sizing. Alerts hit Telegram before I'd even see the tweet. Edge, finally legible.",
  },
  {
    who: "Marcus C.",
    role: "Crypto fund analyst",
    quote:
      "Replaced three internal scripts and a Notion page. The backtest-compare view alone earned the subscription.",
  },
];

export interface FeatureCell {
  icon: string;
  title: string;
  desc: string;
}

export const FEATURE_CELLS: FeatureCell[] = [
  {
    icon: "users",
    title: "Copy trading",
    desc: "Mirror any trader with fixed, proportional, or Kelly sizing. Own-wallet, own-keys.",
  },
  {
    icon: "split",
    title: "Merge arbitrage",
    desc: "Scanner finds YES + NO < $1. One click buys both sides and merges.",
  },
  {
    icon: "store",
    title: "Strategy marketplace",
    desc: "Rent or sell strategies with on-chain verified P&L. 0–20% performance fee.",
  },
  {
    icon: "cpu",
    title: "AI & MCP",
    desc: "News→signal pipeline. Natural-language queries. 33 MCP tools for Claude Desktop.",
  },
  {
    icon: "bell",
    title: "Notifications",
    desc: "Email, in-app, Telegram, Discord, WhatsApp — per-event, per-channel, digests.",
  },
  {
    icon: "chart-bar",
    title: "Analytics",
    desc: "Edge score, P&L attribution, correlation heatmap, calibration curves, tax CSV.",
  },
  {
    icon: "layout-grid",
    title: "Market browser",
    desc: "Every market, filtered. OHLCV charts, order book depth, price alerts.",
  },
  {
    icon: "coins",
    title: "Market making",
    desc: "One-click LP on any market. Set capital + spread, we quote both sides.",
  },
  {
    icon: "rocket",
    title: "Onboarding",
    desc: "Browse → verify → connect. Guided import wizard. 5 strategy templates.",
  },
];

export const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      "Strategy builder",
      "Whale intelligence",
      "Backtest",
      "Paper trading",
      "Marketplace",
    ],
  },
  {
    title: "Developers",
    links: [
      "API reference",
      "TypeScript SDK",
      "Python SDK",
      "Rust SDK",
      "MCP server",
    ],
  },
  {
    title: "Company",
    links: ["About", "Changelog", "Roadmap", "Status", "Contact"],
  },
  { title: "Legal", links: ["Terms", "Privacy", "Risk disclosure", "Cookies"] },
] as const;

export const CODE_TOKENS = [
  { line: 1, tokens: [{ cls: "cm", text: "// TypeScript SDK" }] },
  {
    line: 2,
    tokens: [
      { cls: "kw", text: "import" },
      { cls: "tx", text: " { PolyforgeClient } " },
      { cls: "kw", text: "from" },
      { cls: "tx", text: " " },
      { cls: "str", text: "'@polyforge/sdk'" },
      { cls: "tx", text: ";" },
    ],
  },
  { line: 3, tokens: [{ cls: "tx", text: "" }] },
  {
    line: 4,
    tokens: [
      { cls: "kw", text: "const" },
      { cls: "tx", text: " client = " },
      { cls: "kw", text: "new" },
      { cls: "tx", text: " " },
      { cls: "fn", text: "PolyforgeClient" },
      { cls: "tx", text: "({" },
    ],
  },
  {
    line: 5,
    tokens: [{ cls: "tx", text: "  apiKey: process.env.POLYFORGE_KEY," }],
  },
  { line: 6, tokens: [{ cls: "tx", text: "});" }] },
  { line: 7, tokens: [{ cls: "tx", text: "" }] },
  {
    line: 8,
    tokens: [
      { cls: "kw", text: "for await" },
      { cls: "tx", text: " (" },
      { cls: "kw", text: "const" },
      { cls: "tx", text: " event " },
      { cls: "kw", text: "of" },
    ],
  },
  {
    line: 9,
    tokens: [
      { cls: "tx", text: "  client." },
      { cls: "fn", text: "watchStrategy" },
      { cls: "tx", text: "(strategyId)) {" },
    ],
  },
  {
    line: 10,
    tokens: [{ cls: "cm", text: "  // ORDER_FILLED · +$412 · sharpe 1.84" }],
  },
  {
    line: 11,
    tokens: [
      { cls: "tx", text: "  console." },
      { cls: "fn", text: "log" },
      { cls: "tx", text: "(event.type, event.payload);" },
    ],
  },
  { line: 12, tokens: [{ cls: "tx", text: "}" }] },
] as const;
