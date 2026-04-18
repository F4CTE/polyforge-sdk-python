// Static data + ticker symbols used across the page
const MARKETS = [
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

const BLOCKS = [
  // 6 Event triggers
  { cat: "trigger", name: "new_bet_opens", desc: "Fires when a new market opens in a series" },
  { cat: "trigger", name: "price_crosses_up", desc: "Token price crosses threshold upward" },
  { cat: "trigger", name: "price_crosses_down", desc: "Token price crosses threshold downward" },
  { cat: "trigger", name: "time_before_close", desc: "Fires N minutes before market close" },
  { cat: "trigger", name: "win_streak", desc: "Fires after N consecutive wins" },
  { cat: "trigger", name: "loss_streak", desc: "Fires after N consecutive losses" },
  // 7 Tick triggers
  { cat: "trigger", name: "price_above_tick", desc: "Price is above a threshold on tick" },
  { cat: "trigger", name: "price_below_tick", desc: "Price is below a threshold on tick" },
  { cat: "trigger", name: "spread_below_tick", desc: "Book spread below max on tick" },
  { cat: "trigger", name: "volume_rate_tick", desc: "Volume rate above threshold" },
  { cat: "trigger", name: "price_momentum_tick", desc: "Directional momentum on tick" },
  { cat: "trigger", name: "rsi_threshold_tick", desc: "RSI crosses level N" },
  { cat: "trigger", name: "every_tick", desc: "Fires every tick" },
  // Conditions
  { cat: "condition", name: "min_liquidity", desc: "Order book liquidity ≥ USDC" },
  { cat: "condition", name: "max_position", desc: "Cap position size in USDC" },
  { cat: "condition", name: "max_bets_per_day", desc: "Cap trades per day" },
  { cat: "condition", name: "daily_loss_limit", desc: "Daily USDC loss cap" },
  { cat: "condition", name: "cooldown_after_trade", desc: "Wait Nms after a trade" },
  { cat: "condition", name: "price_in_range", desc: "Price within min/max bounds" },
  { cat: "condition", name: "no_reentry", desc: "Skip markets traded today" },
  { cat: "condition", name: "no_existing_position", desc: "Skip if already holding" },
  { cat: "condition", name: "time_window", desc: "Trade only within hours" },
  // Actions
  { cat: "action", name: "buy_yes", desc: "Place buy on YES — GTC / GTD / FOK" },
  { cat: "action", name: "buy_no", desc: "Place buy on NO — GTC / GTD / FOK" },
  { cat: "action", name: "set_stop_loss", desc: "Attach stop-loss at N%" },
  { cat: "action", name: "take_profit", desc: "Attach take-profit at N%" },
  { cat: "action", name: "scale_in", desc: "Add size to current position" },
  { cat: "action", name: "scale_out", desc: "Reduce size on current position" },
  { cat: "action", name: "cancel_all_orders", desc: "Cancel open orders on market" },
  { cat: "action", name: "skip_bet", desc: "Explicitly skip a tick" },
  // Safety
  { cat: "safety", name: "stop_if_daily_loss", desc: "Halt at daily USDC loss" },
  { cat: "safety", name: "stop_if_orders_per_min", desc: "Halt on order rate breach" },
  { cat: "safety", name: "stop_if_consecutive_loss", desc: "Halt on N straight losses" },
  { cat: "safety", name: "stop_if_exposure_exceeds", desc: "Cap total USDC exposure" },
  { cat: "safety", name: "pause_after_fill", desc: "Pause Nms after a fill" },
  { cat: "safety", name: "max_orders_total", desc: "Halt at N total orders" },
];

const WHALES = [
  { wallet: "0x8f··3a", init: "8F", market: "US Elections 2028 · YES", side: "bought", px: "0.42", size: "$52,000", t: "2m", hl: "gain" },
  { wallet: "0xd4··b7", init: "D4", market: "BTC > $150k by Dec · NO",  side: "sold",   px: "0.31", size: "$31,000", t: "5m", hl: "loss" },
  { wallet: "0xa1··9c", init: "A1", market: "Fed Rate Cut Jul · YES",   side: "bought", px: "0.73", size: "$88,000", t: "8m", hl: "gain" },
  { wallet: "0x21··ef", init: "21", market: "Oscar Best Picture · YES", side: "bought", px: "0.26", size: "$18,400", t: "12m", hl: "gain" },
  { wallet: "0xbc··04", init: "BC", market: "NBA Finals MVP · YES",    side: "sold",   px: "0.39", size: "$24,700", t: "18m", hl: "loss" },
];

const TESTIMONIALS = [
  { who: "Alex K.", role: "Quant, ex-Jane Street", quote: "The block registry is the cleanest IF/THEN I've used outside of our internal tooling. Paper mode → live in one click." },
  { who: "Sarah R.", role: "Discretionary trader", quote: "I mirror two whale wallets with Kelly sizing. Alerts hit Telegram before I'd even see the tweet. Edge, finally legible." },
  { who: "Marcus C.", role: "Crypto fund analyst", quote: "Replaced three internal scripts and a Notion page. The backtest-compare view alone earned the subscription." },
];

const HEADLINES = {
  terminal: { h: <>The trading terminal for <em>prediction markets.</em></>, sub: "Build automated strategies, track whale activity, and backtest your edge on Polymarket — without writing a single line of code." },
  typography: { h: <>Forge an edge. <em>Then automate it.</em></>, sub: "36 blocks. Visual canvas. Paper mode. Live execution. One terminal for everything Polymarket." },
  builder: { h: <>Drag, wire, <em>deploy.</em></>, sub: "A visual strategy builder with real primitives — triggers, conditions, actions, safety. Backtested on Polymarket's full history, live in ≤ 200ms." },
};

Object.assign(window, { MARKETS, BLOCKS, WHALES, TESTIMONIALS, HEADLINES });
