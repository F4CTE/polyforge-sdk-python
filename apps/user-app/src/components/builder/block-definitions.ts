// ─── Block definitions for the strategy builder ─────────────────────────────

export type BlockSection = 'safety' | 'triggers' | 'conditions' | 'actions' | 'logic' | 'calc';

export interface BlockField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'market_slot' | 'combo_slot';
  placeholder: string;
  /** Options for 'select' type fields */
  options?: string[];
  /** If true, this field can receive a data connection from a Variable or Calc node */
  wireable?: boolean;
}

export interface BlockDef {
  type: string;
  label: string;
  description: string;
  fields: BlockField[];
  /** Output port IDs for multi-output logic blocks (e.g. ['true', 'false'] for IF/THEN/ELSE) */
  outputs?: string[];
  /** Sub-group label for palette grouping (e.g. 'Technical Analysis') */
  group?: string;
}

export const SECTION_META: Record<
  BlockSection,
  { label: string; color: string; icon: string }
> = {
  safety:     { label: 'Safety',     color: 'var(--loss)', icon: 'shield' },
  triggers:   { label: 'Triggers',   color: 'var(--warning)', icon: 'zap' },
  conditions: { label: 'Conditions', color: 'var(--info)', icon: 'filter' },
  actions:    { label: 'Actions',    color: 'var(--gain)', icon: 'play' },
  logic:      { label: 'Logic',      color: 'var(--info)', icon: 'git-branch' },
  calc:       { label: 'Calculate', color: 'var(--gain)', icon: 'calculator' },
};

export const SECTION_COLUMNS: Record<BlockSection, number> = {
  safety:     100,
  triggers:   450,
  conditions: 800,
  logic:      1050,
  calc:       1200,
  actions:    1500,
};

export const BLOCK_DEFS: Record<BlockSection, BlockDef[]> = {
  // ── Safety blocks (6) ──────────────────────────────────────────────────────
  safety: [
    {
      type: 'stop_if_daily_loss',
      label: 'Stop on Daily Loss',
      description: 'Halts if cumulative daily loss exceeds threshold.',
      fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '200', wireable: true }],
    },
    {
      type: 'stop_if_consecutive_losses',
      label: 'Stop on Streak Losses',
      description: 'Halts after N consecutive losing trades.',
      fields: [{ key: 'count', label: 'Max consecutive losses', type: 'number', placeholder: '3' }],
    },
    {
      type: 'stop_if_position_size',
      label: 'Max Position Size',
      description: 'Prevents positions larger than limit.',
      fields: [{ key: 'maxPositionUsdc', label: 'Max Position (USDC)', type: 'number', placeholder: '500', wireable: true }],
    },
    {
      type: 'stop_if_drawdown',
      label: 'Max Drawdown',
      description: 'Halts if drawdown exceeds percentage.',
      fields: [{ key: 'maxDrawdownPct', label: 'Max Drawdown (%)', type: 'number', placeholder: '10' }],
    },
    {
      type: 'max_daily_bets',
      label: 'Max Daily Bets',
      description: 'Limits the number of bets placed per day.',
      fields: [{ key: 'count', label: 'Max bets per day', type: 'number', placeholder: '10' }],
    },
    {
      type: 'time_window',
      label: 'Time Window',
      description: 'Only trades within the specified hours (UTC).',
      fields: [
        { key: 'startHour', label: 'Start Hour (0-23)', type: 'number', placeholder: '9' },
        { key: 'endHour', label: 'End Hour (0-23)', type: 'number', placeholder: '17' },
      ],
    },
  ],

  // ── Trigger blocks (17) ────────────────────────────────────────────────────
  triggers: [
    {
      type: 'price_crosses_up',
      label: 'Price Crosses Up',
      description: 'Fires when price crosses above threshold.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'threshold', label: 'Price Threshold', type: 'number', placeholder: '0.60' },
      ],
    },
    {
      type: 'price_crosses_down',
      label: 'Price Crosses Down',
      description: 'Fires when price crosses below threshold.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'threshold', label: 'Price Threshold', type: 'number', placeholder: '0.40' },
      ],
    },
    {
      type: 'price_change_pct',
      label: 'Price Change %',
      description: 'Fires on price change over time window.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'pct', label: 'Change %', type: 'number', placeholder: '5' },
        { key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '60000' },
      ],
    },
    {
      type: 'volume_spike',
      label: 'Volume Spike',
      description: 'Fires when volume multiplier exceeds threshold.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'multiplier', label: 'Multiplier', type: 'number', placeholder: '3' },
      ],
    },
    {
      type: 'market_resolving',
      label: 'Market Resolving',
      description: 'Fires when market enters resolution window.',
      fields: [],
    },
    {
      type: 'market_resolved',
      label: 'Market Resolved',
      description: 'Fires when market resolves.',
      fields: [],
    },
    {
      type: 'price_above',
      label: 'Price Above',
      description: 'True each tick when price is above threshold.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.60' },
      ],
    },
    {
      type: 'price_below',
      label: 'Price Below',
      description: 'True each tick when price is below threshold.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.40' },
      ],
    },
    {
      type: 'spread_below',
      label: 'Spread Below',
      description: 'True when spread is tight enough.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'maxSpread', label: 'Max Spread', type: 'number', placeholder: '0.05' },
      ],
    },
    {
      type: 'liquidity_above',
      label: 'Liquidity Above',
      description: 'True when liquidity meets minimum.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'minLiquidity', label: 'Min Liquidity (USDC)', type: 'number', placeholder: '1000' },
      ],
    },
    {
      type: 'position_open',
      label: 'Position Open',
      description: 'True when an open position exists.',
      fields: [{ key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' }],
    },
    {
      type: 'no_position',
      label: 'No Position',
      description: 'True when no position is open.',
      fields: [{ key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' }],
    },
    {
      type: 'time_between',
      label: 'Time Between',
      description: 'True during specified hours (UTC).',
      fields: [
        { key: 'startHour', label: 'Start Hour', type: 'number', placeholder: '9' },
        { key: 'endHour', label: 'End Hour', type: 'number', placeholder: '17' },
      ],
    },
    // ── Technical Analysis triggers ──
    {
      type: 'ma_crossover_tick',
      label: 'MA Crossover',
      description: 'Fires when short MA crosses long MA.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'shortPeriod', label: 'Short Period', type: 'number', placeholder: '10' },
        { key: 'longPeriod', label: 'Long Period', type: 'number', placeholder: '50' },
        { key: 'maType', label: 'MA Type', type: 'select', placeholder: 'sma', options: ['sma', 'ema'] },
        { key: 'direction', label: 'Direction', type: 'select', placeholder: 'golden_cross', options: ['golden_cross', 'death_cross'] },
      ],
    },
    {
      type: 'macd_signal_tick',
      label: 'MACD Signal',
      description: 'Fires on MACD line crossing signal line.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'fastPeriod', label: 'Fast Period', type: 'number', placeholder: '12' },
        { key: 'slowPeriod', label: 'Slow Period', type: 'number', placeholder: '26' },
        { key: 'signalPeriod', label: 'Signal Period', type: 'number', placeholder: '9' },
        { key: 'signal', label: 'Signal', type: 'select', placeholder: 'line_cross', options: ['line_cross', 'histogram_sign_change'] },
      ],
    },
    {
      type: 'bollinger_breakout_tick',
      label: 'Bollinger Breakout',
      description: 'Fires when price breaks Bollinger Band.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'period', label: 'Period', type: 'number', placeholder: '20' },
        { key: 'stdDevMultiplier', label: 'Std Dev Multiplier', type: 'number', placeholder: '2' },
        { key: 'direction', label: 'Direction', type: 'select', placeholder: 'upper_break', options: ['upper_break', 'lower_break'] },
      ],
    },
    {
      type: 'vwap_cross_tick',
      label: 'VWAP Cross',
      description: 'Fires when price crosses VWAP.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'direction', label: 'Direction', type: 'select', placeholder: 'above', options: ['above', 'below'] },
      ],
    },
  ],

  // ── Condition blocks (9) ───────────────────────────────────────────────────
  conditions: [
    {
      type: 'min_liquidity',
      label: 'Min Liquidity',
      description: 'Requires minimum market liquidity.',
      fields: [{ key: 'minUsdc', label: 'Min USDC', type: 'number', placeholder: '100' }],
    },
    {
      type: 'max_spread',
      label: 'Max Spread',
      description: 'Requires spread below maximum.',
      fields: [{ key: 'maxSpread', label: 'Max Spread', type: 'number', placeholder: '0.04' }],
    },
    {
      type: 'min_price',
      label: 'Min Price',
      description: 'Token price must be above minimum.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'minPrice', label: 'Min Price', type: 'number', placeholder: '0.10' },
      ],
    },
    {
      type: 'max_price',
      label: 'Max Price',
      description: 'Token price must be below maximum.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'maxPrice', label: 'Max Price', type: 'number', placeholder: '0.90' },
      ],
    },
    {
      type: 'no_recent_bet',
      label: 'No Recent Bet',
      description: 'No bet placed in the last N ms.',
      fields: [{ key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '300000' }],
    },
    {
      type: 'daily_loss_below',
      label: 'Daily Loss Below',
      description: 'Daily loss must not exceed threshold.',
      fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '100' }],
    },
    {
      type: 'position_size_below',
      label: 'Position Size Below',
      description: 'Open position must be below limit.',
      fields: [{ key: 'maxUsdc', label: 'Max USDC', type: 'number', placeholder: '500' }],
    },
    {
      type: 'market_open',
      label: 'Market Open',
      description: 'Market must be accepting orders.',
      fields: [],
    },
    {
      type: 'time_in_window',
      label: 'Time in Window',
      description: 'Current time must be within hours (UTC).',
      fields: [
        { key: 'startHour', label: 'Start Hour', type: 'number', placeholder: '9' },
        { key: 'endHour', label: 'End Hour', type: 'number', placeholder: '17' },
      ],
    },
  ],

  // ── Logic blocks (5) ───────────────────────────────────────────────────────
  logic: [
    {
      type: 'IF_THEN_ELSE',
      label: 'If / Then / Else',
      description: 'Conditional branching based on expression.',
      fields: [{ key: 'condition', label: 'Condition', type: 'text', placeholder: '$price > 0.5' }],
      outputs: ['true', 'false'],
    },
    {
      type: 'AND_GATE',
      label: 'AND',
      description: 'Outputs true only if ALL inputs are true.',
      fields: [],
    },
    {
      type: 'OR_GATE',
      label: 'OR',
      description: 'Outputs true if ANY input is true.',
      fields: [],
    },
    {
      type: 'NOT_GATE',
      label: 'NOT',
      description: 'Inverts the boolean input.',
      fields: [],
    },
    {
      type: 'DELAY',
      label: 'Delay',
      description: 'Delays signal propagation by specified seconds.',
      fields: [{ key: 'seconds', label: 'Seconds', type: 'number', placeholder: '5' }],
    },
  ],

  // ── Calculation blocks (9) ─────────────────────────────────────────────────
  calc: [
    {
      type: 'MATH',
      label: 'Math',
      description: 'Perform arithmetic on two inputs (A, B).',
      fields: [
        { key: 'operation', label: 'Operation', type: 'text', placeholder: 'add' },
      ],
    },
    {
      type: 'AGGREGATION',
      label: 'Aggregation',
      description: 'Compute aggregate over a rolling window.',
      fields: [
        { key: 'function', label: 'Function', type: 'text', placeholder: 'moving_average' },
        { key: 'windowSize', label: 'Window Size', type: 'number', placeholder: '20' },
      ],
    },
    {
      type: 'COMPARISON',
      label: 'Comparison',
      description: 'Compare two values, outputs boolean.',
      fields: [
        { key: 'operator', label: 'Operator', type: 'text', placeholder: '>' },
        { key: 'min', label: 'Min (between)', type: 'number', placeholder: '0' },
        { key: 'max', label: 'Max (between)', type: 'number', placeholder: '100' },
      ],
    },
    {
      type: 'ABS_ROUND',
      label: 'Abs / Round',
      description: 'Apply math function to a single value.',
      fields: [
        { key: 'function', label: 'Function', type: 'text', placeholder: 'abs' },
        { key: 'decimals', label: 'Decimals', type: 'number', placeholder: '0' },
      ],
    },
    // ── Technical Analysis indicators ──
    {
      type: 'SMA',
      label: 'SMA',
      description: 'Simple Moving Average over N periods.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'period', label: 'Period', type: 'number', placeholder: '20' },
      ],
    },
    {
      type: 'EMA',
      label: 'EMA',
      description: 'Exponential Moving Average over N periods.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'period', label: 'Period', type: 'number', placeholder: '20' },
      ],
    },
    {
      type: 'MACD',
      label: 'MACD',
      description: 'Moving Average Convergence Divergence.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'fastPeriod', label: 'Fast Period', type: 'number', placeholder: '12' },
        { key: 'slowPeriod', label: 'Slow Period', type: 'number', placeholder: '26' },
        { key: 'signalPeriod', label: 'Signal Period', type: 'number', placeholder: '9' },
        { key: 'output', label: 'Output', type: 'select', placeholder: 'macd_line', options: ['macd_line', 'signal_line', 'histogram'] },
      ],
    },
    {
      type: 'BOLLINGER',
      label: 'Bollinger',
      description: 'Bollinger Bands value for a given band.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'period', label: 'Period', type: 'number', placeholder: '20' },
        { key: 'stdDev', label: 'Std Dev', type: 'number', placeholder: '2' },
        { key: 'output', label: 'Output', type: 'select', placeholder: 'upper', options: ['upper', 'middle', 'lower'] },
      ],
    },
    {
      type: 'ATR',
      label: 'ATR',
      description: 'Average True Range over N periods.',
      group: 'Technical Analysis',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'period', label: 'Period', type: 'number', placeholder: '14' },
      ],
    },
  ],

  // ── Action blocks (8) ──────────────────────────────────────────────────────
  actions: [
    {
      type: 'buy_yes',
      label: 'Buy YES',
      description: 'Buy YES tokens for the specified amount.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
      ],
    },
    {
      type: 'buy_no',
      label: 'Buy NO',
      description: 'Buy NO tokens for the specified amount.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
      ],
    },
    {
      type: 'sell_yes',
      label: 'Sell YES',
      description: 'Sell YES tokens for the specified amount.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
      ],
    },
    {
      type: 'sell_no',
      label: 'Sell NO',
      description: 'Sell NO tokens for the specified amount.',
      fields: [
        { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
        { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
      ],
    },
    {
      type: 'close_position',
      label: 'Close Position',
      description: 'Fully close the position (FOK SELL).',
      fields: [{ key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' }],
    },
    {
      type: 'set_stop_loss',
      label: 'Set Stop Loss',
      description: 'Close position if loss exceeds decimal ratio.',
      fields: [{ key: 'pct', label: 'Stop Loss', type: 'number', placeholder: '0.10' }],
    },
    {
      type: 'set_take_profit',
      label: 'Set Take Profit',
      description: 'Close position if profit reaches decimal ratio.',
      fields: [{ key: 'pct', label: 'Take Profit', type: 'number', placeholder: '0.20' }],
    },
    {
      type: 'notify',
      label: 'Notify',
      description: 'Send a notification when this action fires.',
      fields: [{ key: 'message', label: 'Message', type: 'text', placeholder: 'Alert triggered' }],
    },
    {
      type: 'RUN_STRATEGY',
      label: 'Run Strategy',
      description: 'Launch another strategy as a sub-strategy.',
      fields: [
        { key: 'strategyId', label: 'Strategy', type: 'select', placeholder: 'Select a strategy' },
        { key: 'mode', label: 'Mode', type: 'select', placeholder: 'Select mode', options: ['fire_and_forget', 'managed', 'scoped'] },
      ],
    },
    {
      type: 'combo_leg',
      label: 'Combo Market',
      description: 'Trade a Kalshi combo/multivariate event across multiple legs.',
      group: 'Kalshi',
      fields: [
        { key: 'marketTicker', label: 'Combo Market', type: 'combo_slot', placeholder: 'Select combo market...' },
        { key: 'side', label: 'Side', type: 'select', placeholder: 'yes', options: ['yes', 'no'] },
        { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        { key: 'orderType', label: 'Order Type', type: 'select', placeholder: 'GTC', options: ['GTC', 'GTD', 'FOK', 'FAK'] },
      ],
    },
  ],
};

export const DEFAULT_MARKET_SLOTS = ['$MARKET_A', '$MARKET_B', '$MARKET_C', '$MARKET_D', '$MARKET_E'];

/** Find a block definition by type across all sections */
export function findBlockDef(type: string): (BlockDef & { section: BlockSection }) | undefined {
  for (const section of Object.keys(BLOCK_DEFS) as BlockSection[]) {
    const found = BLOCK_DEFS[section].find((d) => d.type === type);
    if (found) return { ...found, section };
  }
  return undefined;
}
