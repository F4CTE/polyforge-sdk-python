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
} from "./calc.blocks";

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
} from "./action.blocks";

export const SAFETY_REGISTRY: Record<string, BlockEvaluator> = {
  DAILY_LOSS_LIMIT: StopIfDailyLossBlock,
  stop_if_daily_loss: StopIfDailyLossBlock,
  ORDERS_PER_MIN: StopIfOrdersPerMinBlock,
  stop_if_orders_per_min: StopIfOrdersPerMinBlock,
  CONSECUTIVE_LOSS: StopIfConsecutiveLossBlock,
  stop_if_consecutive_loss: StopIfConsecutiveLossBlock,
  EXPOSURE_EXCEEDS: StopIfExposureExceedsBlock,
  stop_if_exposure_exceeds: StopIfExposureExceedsBlock,
  PAUSE_AFTER_FILL: PauseAfterFillBlock,
  pause_after_fill: PauseAfterFillBlock,
  MAX_POSITION_SIZE: MaxOrdersTotalBlock,
  max_orders_total: MaxOrdersTotalBlock,
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
  PRICE_ABOVE: PriceAboveTickBlock,
  price_below_tick: PriceBelowTickBlock,
  PRICE_BELOW: PriceBelowTickBlock,
  spread_below_tick: SpreadBelowTickBlock,
  SPREAD_ABOVE: SpreadBelowTickBlock,
  volume_rate_tick: VolumeRateTickBlock,
  price_momentum_tick: PriceMomentumTickBlock,
  rsi_threshold_tick: RsiThresholdTickBlock,
  TICK: EveryTickBlock,
  every_tick: EveryTickBlock,
  ma_crossover_tick: MaCrossoverTickBlock,
  MA_CROSSOVER: MaCrossoverTickBlock,
  macd_signal_tick: MacdSignalTickBlock,
  MACD_SIGNAL: MacdSignalTickBlock,
  bollinger_breakout_tick: BollingerBreakoutTickBlock,
  BOLLINGER_BREAKOUT: BollingerBreakoutTickBlock,
  vwap_cross_tick: VwapCrossTickBlock,
  VWAP_CROSS: VwapCrossTickBlock,
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
};

export const ACTION_REGISTRY: Record<string, ActionEvaluator> = {
  BUY: BuyYesAction,
  buy_yes: BuyYesAction,
  buy_no: BuyNoAction,
  SELL: ScaleOutAction,
  set_stop_loss: SetStopLossAction,
  take_profit: TakeProfitAction,
  scale_in: ScaleInAction,
  scale_out: ScaleOutAction,
  cancel_all_orders: CancelAllOrdersAction,
  WAIT: SkipBetAction,
  skip_bet: SkipBetAction,
  RUN_STRATEGY: RunStrategyAction,
  run_strategy: RunStrategyAction,
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
};
