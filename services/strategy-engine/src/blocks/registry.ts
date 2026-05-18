import {
  BlockEvaluator,
  ActionEvaluator,
  LogicBlockEvaluator,
  CalcBlockEvaluator,
} from "./block.types";

import {
  StopIfDailyLossBlock,
  StopIfOrdersPerMinBlock,
  StopIfConsecutiveLossBlock,
  StopIfExposureExceedsBlock,
  StopIfMaxDrawdownBlock,
  PauseAfterFillBlock,
  MaxOrdersTotalBlock,
} from "./safety.blocks";

import {
  NewBetOpensBlock,
  PriceCrossesUpBlock,
  PriceCrossesDownBlock,
  TimeBeforeCloseBlock,
  WinStreakBlock,
  LossStreakBlock,
  PriceAboveTickBlock,
  PriceBelowTickBlock,
  SpreadBelowTickBlock,
  VolumeRateTickBlock,
  PriceMomentumTickBlock,
  RsiThresholdTickBlock,
  EveryTickBlock,
  MaCrossoverTickBlock,
  MacdSignalTickBlock,
  BollingerBreakoutTickBlock,
  VwapCrossTickBlock,
} from "./trigger.blocks";

import {
  MinLiquidityBlock,
  MaxPositionBlock,
  MaxBetsPerDayBlock,
  DailyLossLimitBlock,
  CooldownAfterTradeBlock,
  PriceInRangeBlock,
  NoReentryBlock,
  NoExistingPositionBlock,
  TimeWindowBlock,
} from "./condition.blocks";

import {
  IfThenElseBlock,
  AndGateBlock,
  OrGateBlock,
  NotGateBlock,
  DelayBlock,
} from "./logic.blocks";

import {
  MathBlockEvaluator,
  AggregationBlockEvaluator,
  ComparisonBlockEvaluator,
  AbsRoundBlockEvaluator,
  SmaBlockEvaluator,
  EmaBlockEvaluator,
  MacdBlockEvaluator,
  BollingerBlockEvaluator,
  AtrBlockEvaluator,
} from "./calc.blocks";

import { VenueSelectBlock } from "./venue-select.block";

import {
  GameStartedBlock,
  PregameWindowBlock,
  HalftimeBlock,
  SportScoreAboveBlock,
} from "./sports.blocks";

import {
  BuyYesAction,
  BuyNoAction,
  SetStopLossAction,
  TakeProfitAction,
  ScaleInAction,
  ScaleOutAction,
  CancelAllOrdersAction,
  SkipBetAction,
  RunStrategyAction,
  ComboLegAction,
} from "./action.blocks";

export const SAFETY_REGISTRY: Record<string, BlockEvaluator> = {
  DAILY_LOSS_LIMIT: StopIfDailyLossBlock,
  stop_if_daily_loss: StopIfDailyLossBlock,
  STOP_IF_DAILY_LOSS: StopIfDailyLossBlock,
  ORDERS_PER_MIN: StopIfOrdersPerMinBlock,
  stop_if_orders_per_min: StopIfOrdersPerMinBlock,
  CONSECUTIVE_LOSS: StopIfConsecutiveLossBlock,
  stop_if_consecutive_loss: StopIfConsecutiveLossBlock,
  STOP_IF_CONSECUTIVE_LOSS: StopIfConsecutiveLossBlock,
  EXPOSURE_EXCEEDS: StopIfExposureExceedsBlock,
  stop_if_exposure_exceeds: StopIfExposureExceedsBlock,
  STOP_IF_EXPOSURE_EXCEEDS: StopIfExposureExceedsBlock,
  PAUSE_AFTER_FILL: PauseAfterFillBlock,
  pause_after_fill: PauseAfterFillBlock,
  // MAX_POSITION_SIZE / max_position intentionally left in CONDITION_REGISTRY only.
  // Legacy configs that carry it under safety are handled by strategy-runner.ts
  // via LEGACY_SAFETY_ALIASES — an explicit allowlist that evaluates the
  // CONDITION_REGISTRY entry as a safety guard (fired=true → pass, fired=false
  // → stop).  Only known legacy safety types are allowed; unrecognized types
  // fail closed to prevent misconfigured condition-only types from bypassing
  // the safety boundary.
  max_orders_total: MaxOrdersTotalBlock,
  MAX_ORDERS_TOTAL: MaxOrdersTotalBlock,
  MAX_BETS_PER_DAY: MaxBetsPerDayBlock,
  MAX_DRAWDOWN: StopIfMaxDrawdownBlock,
  max_drawdown: StopIfMaxDrawdownBlock,
};

export const TRIGGER_REGISTRY: Record<string, BlockEvaluator> = {
  new_bet_opens: NewBetOpensBlock,
  PRICE_CROSSES_UP: PriceCrossesUpBlock,
  price_crosses_up: PriceCrossesUpBlock,
  PRICE_CROSSES_DOWN: PriceCrossesDownBlock,
  price_crosses_down: PriceCrossesDownBlock,
  time_before_close: TimeBeforeCloseBlock,
  win_streak: WinStreakBlock,
  WIN_STREAK: WinStreakBlock,
  loss_streak: LossStreakBlock,
  LOSS_STREAK: LossStreakBlock,
  price_above_tick: PriceAboveTickBlock,
  price_above: PriceAboveTickBlock,
  PRICE_ABOVE: PriceAboveTickBlock,
  price_below_tick: PriceBelowTickBlock,
  price_below: PriceBelowTickBlock,
  PRICE_BELOW: PriceBelowTickBlock,
  spread_below_tick: SpreadBelowTickBlock,
  SPREAD_BELOW: SpreadBelowTickBlock,
  SPREAD_ABOVE: SpreadBelowTickBlock,
  volume_rate_tick: VolumeRateTickBlock,
  price_momentum_tick: PriceMomentumTickBlock,
  rsi_threshold_tick: RsiThresholdTickBlock,
  TICK: EveryTickBlock,
  every_tick: EveryTickBlock,
  EVERY_TICK: EveryTickBlock,
  ma_crossover_tick: MaCrossoverTickBlock,
  MA_CROSSOVER: MaCrossoverTickBlock,
  macd_signal_tick: MacdSignalTickBlock,
  MACD_SIGNAL: MacdSignalTickBlock,
  bollinger_breakout_tick: BollingerBreakoutTickBlock,
  BOLLINGER_BREAKOUT: BollingerBreakoutTickBlock,
  vwap_cross_tick: VwapCrossTickBlock,
  VWAP_CROSS: VwapCrossTickBlock,
  GAME_STARTED: GameStartedBlock,
  game_started: GameStartedBlock,
  PREGAME_WINDOW: PregameWindowBlock,
  pregame_window: PregameWindowBlock,
  HALFTIME: HalftimeBlock,
  halftime: HalftimeBlock,
};

export const CONDITION_REGISTRY: Record<string, BlockEvaluator> = {
  min_liquidity: MinLiquidityBlock,
  max_position: MaxPositionBlock,
  MAX_POSITION_SIZE: MaxPositionBlock,
  BETS_TODAY_LESS_THAN: MaxBetsPerDayBlock,
  max_bets_per_day: MaxBetsPerDayBlock,
  DAILY_LOSS_LIMIT: DailyLossLimitBlock,
  daily_loss_limit: DailyLossLimitBlock,
  cooldown_after_trade: CooldownAfterTradeBlock,
  price_in_range: PriceInRangeBlock,
  PRICE_IN_RANGE: PriceInRangeBlock,
  no_reentry: NoReentryBlock,
  no_existing_position: NoExistingPositionBlock,
  time_window: TimeWindowBlock,
  SPORT_SCORE_ABOVE: SportScoreAboveBlock,
  sport_score_above: SportScoreAboveBlock,
  VENUE_SELECT: VenueSelectBlock,
  venue_select: VenueSelectBlock,
  minimize_fees: VenueSelectBlock,
  SPREAD_BELOW_CONDITION: SpreadBelowTickBlock,
  spread_below_condition: SpreadBelowTickBlock,
};

export const ACTION_REGISTRY: Record<string, ActionEvaluator> = {
  BUY: BuyYesAction,
  buy_yes: BuyYesAction,
  buy_no: BuyNoAction,
  SELL: ScaleOutAction,
  SET_STOP_LOSS: SetStopLossAction,
  set_stop_loss: SetStopLossAction,
  TAKE_PROFIT: TakeProfitAction,
  take_profit: TakeProfitAction,
  scale_in: ScaleInAction,
  scale_out: ScaleOutAction,
  cancel_all_orders: CancelAllOrdersAction,
  WAIT: SkipBetAction,
  skip_bet: SkipBetAction,
  RUN_STRATEGY: RunStrategyAction,
  run_strategy: RunStrategyAction,
  COMBO_LEG: ComboLegAction,
  combo_leg: ComboLegAction,
};

export const LOGIC_REGISTRY: Record<string, LogicBlockEvaluator> = {
  IF_THEN_ELSE: IfThenElseBlock,
  AND_GATE: AndGateBlock,
  OR_GATE: OrGateBlock,
  NOT_GATE: NotGateBlock,
  DELAY: DelayBlock,
};

export const CALC_REGISTRY: Record<string, CalcBlockEvaluator> = {
  MATH: MathBlockEvaluator,
  AGGREGATION: AggregationBlockEvaluator,
  COMPARISON: ComparisonBlockEvaluator,
  ABS_ROUND: AbsRoundBlockEvaluator,
  SMA: SmaBlockEvaluator,
  EMA: EmaBlockEvaluator,
  MACD: MacdBlockEvaluator,
  BOLLINGER: BollingerBlockEvaluator,
  ATR: AtrBlockEvaluator,
};
