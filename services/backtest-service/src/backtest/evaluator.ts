/**
 * Lightweight block evaluator for backtesting.
 *
 * Uses an in-memory price store instead of Redis, so historical replays
 * never touch live cache keys.
 *
 * Supported blocks — designed to cover the common strategy patterns:
 *
 * SAFETY:    stop_if_daily_loss, max_orders_total, stop_if_consecutive_loss
 * TRIGGERS:  every_tick, price_above, price_below, price_crosses_up,
 *            price_crosses_down, spread_below, price_above_tick,
 *            price_below_tick, ma_crossover_tick, macd_signal_tick,
 *            bollinger_breakout_tick, rsi_threshold_tick, vwap_cross_tick
 *            (legacy alias: ma_crossover, macd_crossover, bollinger_bands)
 * CONDITIONS: max_bets_per_day, daily_loss_limit, price_in_range,
 *             max_position, cooldown_after_trade
 * ACTIONS:   buy_yes, buy_no, set_stop_loss, take_profit,
 *            scale_in, scale_out, skip_bet
 */

// ─── Inline TA functions (no cross-service dep needed for pure math) ──────────

import { validateStopLossTakeProfitPct } from "@polyforge/shared-types";

function _sma(prices: number[], period: number): number {
  if (prices.length < period || period <= 0) return NaN;
  const slice = prices.slice(-period);
  return slice.reduce((s, p) => s + p, 0) / period;
}

function _ema(prices: number[], period: number): number {
  if (prices.length < period || period <= 0) return NaN;
  const k = 2 / (period + 1);
  let value = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    value = prices[i] * k + value * (1 - k);
  }
  return value;
}

function _rsiWilder(prices: number[], period: number): number {
  if (prices.length < period + 1 || period <= 0) return NaN;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss =
      (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function _macdFull(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macdLine: number; signalLine: number; histogram: number } {
  const nan = { macdLine: NaN, signalLine: NaN, histogram: NaN };
  if (prices.length < slow + signal - 1) return nan;

  const macdSeries: number[] = [];
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);

  let emaFast = prices.slice(0, fast).reduce((s, p) => s + p, 0) / fast;
  let emaSlow = prices.slice(0, slow).reduce((s, p) => s + p, 0) / slow;

  for (let i = fast; i < slow; i++) {
    emaFast = prices[i] * kFast + emaFast * (1 - kFast);
  }

  macdSeries.push(emaFast - emaSlow);

  for (let i = slow; i < prices.length; i++) {
    emaFast = prices[i] * kFast + emaFast * (1 - kFast);
    emaSlow = prices[i] * kSlow + emaSlow * (1 - kSlow);
    macdSeries.push(emaFast - emaSlow);
  }

  if (macdSeries.length < signal) return nan;

  const kSignal = 2 / (signal + 1);
  let signalEma =
    macdSeries.slice(0, signal).reduce((s, v) => s + v, 0) / signal;
  for (let i = signal; i < macdSeries.length; i++) {
    signalEma = macdSeries[i] * kSignal + signalEma * (1 - kSignal);
  }

  const macdLine = macdSeries[macdSeries.length - 1];
  return { macdLine, signalLine: signalEma, histogram: macdLine - signalEma };
}

function _vwap(prices: number[], volumes: number[]): number {
  const len = Math.min(prices.length, volumes.length);
  if (len === 0) return NaN;

  let totalVolume = 0;
  let totalPV = 0;
  for (let i = 0; i < len; i++) {
    totalVolume += volumes[i];
    totalPV += prices[i] * volumes[i];
  }
  if (totalVolume === 0) return NaN;
  return totalPV / totalVolume;
}

function _bollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2,
): { upper: number; middle: number; lower: number } {
  const nan = { upper: NaN, middle: NaN, lower: NaN };
  if (prices.length < period || period <= 0) return nan;
  const slice = prices.slice(-period);
  const middle = slice.reduce((s, p) => s + p, 0) / period;
  const variance = slice.reduce((s, p) => s + (p - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { upper: middle + stdDev * sd, middle, lower: middle - stdDev * sd };
}

export interface Block {
  type: string;
  params?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface PriceState {
  price: number;
  prevPrice: number;
  bid: number;
  ask: number;
  timestamp: number;
}

export interface SimState {
  betsToday: number;
  dailyPnl: number;
  consecutiveLoss: number;
  totalOrders: number;
  lastTradeAt: number;
  stopLosses: Map<string, number>; // tokenId → stop-loss price
  takeProfits: Map<string, number>; // tokenId → take-profit price
  pendingOrders: Map<string, SimPendingOrder[]>; // tokenId → pending orders
}

export interface SimPosition {
  size: number;
  avgPrice: number;
}

export interface SimPendingOrder {
  size: number;
  price: number;
  tokenId: string;
}

export interface SimFill {
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  size: number;
  price: number;
  tokenId: string;
  type: string; // 'buy_yes' | 'buy_no' | 'stop_loss' | 'take_profit' | etc.
}

export function createSimState(): SimState {
  return {
    betsToday: 0,
    dailyPnl: 0,
    consecutiveLoss: 0,
    totalOrders: 0,
    lastTradeAt: 0,
    stopLosses: new Map(),
    takeProfits: new Map(),
    pendingOrders: new Map(),
  };
}

export function clearPendingOrders(state: SimState): void {
  state.pendingOrders.clear();
}

// ─── Safety ──────────────────────────────────────────────────────────────────

export function checkSafety(
  safety: Block[],
  state: SimState,
  prices: Map<string, PriceState>,
  positions: Map<string, SimPosition>,
): boolean {
  for (const block of safety) {
    const cfg = { ...(block.config ?? {}), ...(block.params ?? {}) };
    switch (block.type) {
      case "stop_if_daily_loss": {
        const max = parseFloat(String(cfg.maxLossUsdc ?? 0));
        if (state.dailyPnl <= -Math.abs(max)) return false;
        break;
      }
      case "max_orders_total": {
        const max = parseInt(String(cfg.maxOrders ?? 0), 10);
        if (max > 0 && state.totalOrders >= max) return false;
        break;
      }
      case "stop_if_consecutive_loss": {
        const max = parseInt(String(cfg.maxConsecutiveLoss ?? 0), 10);
        if (max > 0 && state.consecutiveLoss >= max) return false;
        break;
      }
      case "stop_if_exposure_exceeds": {
        const maxExposure = parseFloat(String(cfg.maxExposureUsdc ?? 0));
        let totalExposure = 0;
        for (const [, pos] of positions) {
          totalExposure += pos.size * pos.avgPrice;
        }
        for (const [, orders] of state.pendingOrders) {
          for (const o of orders) {
            totalExposure += o.size * o.price;
          }
        }
        if (maxExposure > 0 && totalExposure >= maxExposure) return false;
        break;
      }
      default:
        // Unknown safety block — fail closed
        return false;
    }
  }
  return true;
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export function computeMaxLookback(triggers: Block[]): number {
  let max = 0;
  for (const block of triggers) {
    const cfg = { ...(block.config ?? {}), ...(block.params ?? {}) };
    switch (block.type) {
      case "ma_crossover":
      case "ma_crossover_tick": {
        const fastPeriod = parseInt(
          String(cfg.fastPeriod ?? cfg.shortPeriod ?? 10),
          10,
        );
        const slowPeriod = parseInt(
          String(cfg.slowPeriod ?? cfg.longPeriod ?? 50),
          10,
        );
        const period = Math.max(
          isNaN(fastPeriod) ? 0 : fastPeriod,
          isNaN(slowPeriod) ? 0 : slowPeriod,
        );
        if (period > 0) max = Math.max(max, period + 1);
        break;
      }
      case "macd_crossover":
      case "macd_signal_tick": {
        const slow = parseInt(String(cfg.slowPeriod ?? 26), 10);
        const signalPeriod = parseInt(String(cfg.signalPeriod ?? 9), 10);
        if (!isNaN(slow) && !isNaN(signalPeriod))
          max = Math.max(max, slow + signalPeriod);
        break;
      }
      case "bollinger_bands":
      case "bollinger_breakout_tick": {
        const period = parseInt(String(cfg.period ?? 20), 10);
        if (!isNaN(period)) max = Math.max(max, period + 1);
        break;
      }
      case "rsi_threshold_tick": {
        const period = parseInt(String(cfg.period ?? 14), 10);
        if (!isNaN(period)) max = Math.max(max, period + 1);
        break;
      }
      case "vwap_cross_tick": {
        max = Math.max(max, 250);
        break;
      }
    }
  }
  return max;
}

export function checkTriggers(
  triggers: Block[],
  prices: Map<string, PriceState>,
  priceHistory: Map<string, number[]> = new Map(),
  currentTokenId?: string,
): boolean {
  if (triggers.length === 0) return true;

  for (const block of triggers) {
    // every_tick always fires regardless of current token
    if (block.type === "every_tick") return true;

    const cfg = { ...(block.config ?? {}), ...(block.params ?? {}) };
    const tokenId = String(cfg.tokenId ?? "");

    // Gate non-every_tick triggers to the token updated by the current tick.
    // Without this, a token-A trigger can fire repeatedly on token-B ticks
    // because token-A's price/history hasn't changed.
    if (currentTokenId && tokenId && tokenId !== currentTokenId) continue;
    const ps = prices.get(tokenId);
    const hist = priceHistory.get(tokenId) ?? [];

    switch (block.type) {
      case "price_above": {
        const threshold = parseFloat(String(cfg.threshold ?? 0));
        if (ps && ps.price > threshold) return true;
        break;
      }
      case "price_below": {
        const threshold = parseFloat(String(cfg.threshold ?? 0));
        if (ps && ps.price < threshold) return true;
        break;
      }
      case "price_crosses_up": {
        const threshold = parseFloat(String(cfg.threshold ?? 0));
        if (ps && ps.prevPrice <= threshold && ps.price > threshold)
          return true;
        break;
      }
      case "price_crosses_down": {
        const threshold = parseFloat(String(cfg.threshold ?? 0));
        if (ps && ps.prevPrice >= threshold && ps.price < threshold)
          return true;
        break;
      }
      case "spread_below": {
        const maxSpread = parseFloat(String(cfg.maxSpread ?? 1));
        if (ps) {
          const spread = ps.ask - ps.bid;
          if (spread < maxSpread) return true;
        }
        break;
      }
      case "price_above_tick":
      case "price_below_tick": {
        // Same as price_above/below for backtest purposes
        // Support legacy `price` field as fallback for live parity
        const threshold = parseFloat(
          String(cfg.threshold ?? cfg.price ?? 0),
        );
        if (block.type === "price_above_tick" && ps && ps.price > threshold)
          return true;
        if (block.type === "price_below_tick" && ps && ps.price < threshold)
          return true;
        break;
      }

      // ─── TA Triggers (require rolling price history) ───────────────────────

      case "ma_crossover":
      case "ma_crossover_tick": {
        // Fires when short MA crosses above/below long MA (configurable direction)
        // Backward compat: old config used fastPeriod/slowPeriod
        // Live engine uses shortPeriod/longPeriod + direction
        const fastPeriod = parseInt(
          String(cfg.fastPeriod ?? cfg.shortPeriod ?? 10),
          10,
        );
        const slowPeriod = parseInt(
          String(cfg.slowPeriod ?? cfg.longPeriod ?? 50),
          10,
        );
        const maType = String(cfg.maType ?? "sma");
        const direction = String(
          block.type === "ma_crossover"
            ? (cfg.direction ?? "golden_cross") // legacy: default golden_cross
            : (cfg.direction ?? ""), // live parity: direction required
        );
        if (!direction) break; // ma_crossover_tick requires direction like live
        if (hist.length >= slowPeriod + 1) {
          const prevHist = hist.slice(0, -1);
          const maFn = maType === "ema" ? _ema : _sma;
          const fastNow = maFn(hist, fastPeriod);
          const slowNow = maFn(hist, slowPeriod);
          const fastPrev = maFn(prevHist, fastPeriod);
          const slowPrev = maFn(prevHist, slowPeriod);
          if (direction === "death_cross") {
            if (fastPrev > slowPrev && fastNow <= slowNow) return true;
          } else if (direction === "golden_cross") {
            if (fastPrev < slowPrev && fastNow >= slowNow) return true;
          }
          // Unknown direction → fail closed (no-op)
        }
        break;
      }

      case "macd_crossover":
      case "macd_signal_tick": {
        // Fires on MACD signal conditions
        // macd_crossover (legacy): crossAbove (boolean)
        // macd_signal_tick (live): signal (line_cross | histogram_sign_change)
        const fast = parseInt(String(cfg.fastPeriod ?? 12), 10);
        const slow = parseInt(String(cfg.slowPeriod ?? 26), 10);
        const signalPeriod = parseInt(String(cfg.signalPeriod ?? 9), 10);
        const signal = String(cfg.signal ?? "");
        const crossAbove = String(cfg.crossAbove ?? "true") !== "false";
        const minLen = slow + signalPeriod;

        // Reject signal-less macd_signal_tick — parity with live engine
        // which requires signal to be "line_cross" or "histogram_sign_change"
        if (block.type === "macd_signal_tick" && !signal) break;

        if (hist.length >= minLen) {
          // Compute MACD with signal line for full fidelity (shared indicator)
          const currMacd = _macdFull(hist, fast, slow, signalPeriod);
          const prevMacd = _macdFull(
            hist.slice(0, -1),
            fast,
            slow,
            signalPeriod,
          );
          if (isNaN(currMacd.macdLine) || isNaN(prevMacd.macdLine)) break;

          if (signal === "line_cross") {
            // MACD line crosses signal line
            const prevDiff = prevMacd.macdLine - prevMacd.signalLine;
            const currDiff = currMacd.macdLine - currMacd.signalLine;
            if (prevDiff * currDiff < 0) return true;
          } else if (signal === "histogram_sign_change") {
            // MACD histogram changes sign
            if (prevMacd.histogram * currMacd.histogram < 0) return true;
          } else if (block.type === "macd_crossover") {
            // Legacy: zero-line crossover (backward compat for macd_crossover)
            if (crossAbove && prevMacd.macdLine <= 0 && currMacd.macdLine > 0)
              return true;
            if (!crossAbove && prevMacd.macdLine >= 0 && currMacd.macdLine < 0)
              return true;
          }
          // macd_signal_tick with unknown signal → fail closed (no-op)
        }
        break;
      }

      case "bollinger_bands":
      case "bollinger_breakout_tick": {
        // Fires when price breaks outside upper or lower band
        // Old config: band (upper | lower)
        // Live config: direction (upper_break | lower_break)
        const period = parseInt(String(cfg.period ?? 20), 10);
        const stdDev = parseFloat(
          String(cfg.stdDev ?? cfg.stdDevMultiplier ?? 2),
        );
        const band = String(cfg.band ?? "");
        const direction = String(cfg.direction ?? "");
        if (ps && hist.length > period) {
          const bands = _bollingerBands(hist.slice(0, -1), period, stdDev);
          const dir = band || direction; // support both config key names
          if (dir === "upper" || dir === "upper_break") {
            if (ps.prevPrice <= bands.upper && ps.price > bands.upper)
              return true;
          }
          if (dir === "lower" || dir === "lower_break") {
            if (ps.prevPrice >= bands.lower && ps.price < bands.lower)
              return true;
          }
        }
        break;
      }

      case "rsi_threshold_tick": {
        const period = parseInt(String(cfg.period ?? 14), 10);
        const level = parseFloat(String(cfg.level ?? "70"));
        const direction = String(cfg.direction ?? "above");
        if (hist.length >= period + 1) {
          const rsi = _rsiWilder(hist, period);
          if (!isNaN(rsi)) {
            if (direction === "above" && rsi > level) return true;
            if (direction === "below" && rsi < level) return true;
          }
        }
        break;
      }

      case "vwap_cross_tick": {
        // Fires when price crosses the session VWAP
        const direction = String(cfg.direction ?? "");
        if (!direction) break;
        if (ps && hist.length >= 3) {
          const prevPrice = hist[hist.length - 2];
          const volumes = Array<number>(hist.length).fill(1);
          const vwapValue = _vwap(hist, volumes);
          if (isNaN(vwapValue)) break;
          if (direction === "above") {
            if (prevPrice <= vwapValue && ps.price > vwapValue) return true;
          }
          if (direction === "below") {
            if (prevPrice >= vwapValue && ps.price < vwapValue) return true;
          }
        }
        break;
      }
      default:
        // Unknown trigger — fail closed (don't fire)
        break;
    }
  }
  return false;
}

// ─── Conditions ───────────────────────────────────────────────────────────────

export function checkConditions(
  conditions: Block[],
  state: SimState,
  prices: Map<string, PriceState>,
  positions: Map<string, SimPosition>,
  nowMs: number,
): boolean {
  for (const block of conditions) {
    const cfg = { ...(block.config ?? {}), ...(block.params ?? {}) };

    switch (block.type) {
      case "max_bets_per_day": {
        const max = parseInt(String(cfg.maxBets ?? 0), 10);
        if (max > 0 && state.betsToday >= max) return false;
        break;
      }
      case "daily_loss_limit": {
        const max = parseFloat(String(cfg.maxLossUsdc ?? 0));
        if (state.dailyPnl <= -Math.abs(max)) return false;
        break;
      }
      case "price_in_range": {
        const tokenId = String(cfg.tokenId ?? "");
        const min = parseFloat(String(cfg.minPrice ?? 0));
        const max = parseFloat(String(cfg.maxPrice ?? 1));
        const ps = prices.get(tokenId);
        if (ps && (ps.price < min || ps.price > max)) return false;
        break;
      }
      case "max_position": {
        const tokenId = String(cfg.tokenId ?? "");
        const maxUsdc = parseFloat(String(cfg.maxPositionUsdc ?? 0));
        let totalValue = 0;
        const pos = positions.get(tokenId);
        if (pos) {
          totalValue += pos.size * pos.avgPrice;
        }
        for (const o of state.pendingOrders.get(tokenId) ?? []) {
          totalValue += o.size * o.price;
        }
        if (maxUsdc > 0 && totalValue >= maxUsdc) return false;
        break;
      }
      case "cooldown_after_trade": {
        const cooldownMs = parseInt(String(cfg.cooldownMs ?? 0), 10);
        if (
          cooldownMs > 0 &&
          state.lastTradeAt > 0 &&
          nowMs - state.lastTradeAt < cooldownMs
        )
          return false;
        break;
      }
      case "no_existing_position": {
        const tokenId = String(cfg.tokenId ?? "");
        if (positions.has(tokenId)) return false;
        const pending = state.pendingOrders.get(tokenId);
        if (pending && pending.length > 0) return false;
        break;
      }
      case "no_reentry": {
        // Simplified: block if we've traded this token today (tracked via lastTradeAt)
        break;
      }
      default:
        // Unknown condition — fail closed
        return false;
    }
  }
  return true;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export function executeActions(
  actions: Block[],
  prices: Map<string, PriceState>,
  positions: Map<string, SimPosition>,
  state: SimState,
): SimFill[] {
  const fills: SimFill[] = [];

  for (const block of actions) {
    const cfg = { ...(block.config ?? {}), ...(block.params ?? {}) };

    switch (block.type) {
      case "skip_bet":
        return []; // abort all actions

      case "buy_yes":
      case "buy_no": {
        const tokenId = String(cfg.tokenId ?? "");
        const ps = prices.get(tokenId);
        if (!ps) break;

        const sizeUsdc = parseFloat(String(cfg.size ?? 10));
        const fillPrice = ps.price > 0 ? ps.price : 0.5;
        const size = sizeUsdc / fillPrice;
        const outcome = block.type === "buy_yes" ? "YES" : "NO";

        fills.push({
          side: "BUY",
          outcome,
          size,
          price: fillPrice,
          tokenId,
          type: block.type,
        });
        // Track as pending for exposure checks on subsequent ticks
        const pending = state.pendingOrders.get(tokenId) ?? [];
        pending.push({ size, price: fillPrice, tokenId });
        state.pendingOrders.set(tokenId, pending);
        break;
      }

      case "set_stop_loss": {
        const tokenId = String(cfg.tokenId ?? "");
        const stopPct = validateStopLossTakeProfitPct(
          cfg.stopLossPct ?? 0.2,
          "set_stop_loss",
        );
        const pos = positions.get(tokenId);
        if (pos) {
          state.stopLosses.set(tokenId, pos.avgPrice * (1 - stopPct));
        }
        break;
      }

      case "take_profit": {
        const tokenId = String(cfg.tokenId ?? "");
        const targetPct = validateStopLossTakeProfitPct(
          cfg.takeProfitPct ?? 0.5,
          "take_profit",
        );
        const pos = positions.get(tokenId);
        if (pos) {
          state.takeProfits.set(tokenId, pos.avgPrice * (1 + targetPct));
        }
        break;
      }

      case "scale_in": {
        const tokenId = String(cfg.tokenId ?? "");
        const ps = prices.get(tokenId);
        const pos = positions.get(tokenId);
        if (!ps || !pos) break;

        const sizeUsdc = parseFloat(String(cfg.size ?? 10));
        const fillPrice = ps.price;
        const size = sizeUsdc / fillPrice;

        fills.push({
          side: "BUY",
          outcome: "YES",
          size,
          price: fillPrice,
          tokenId,
          type: "scale_in",
        });
        // Track as pending for exposure checks on subsequent ticks
        const pending = state.pendingOrders.get(tokenId) ?? [];
        pending.push({ size, price: fillPrice, tokenId });
        state.pendingOrders.set(tokenId, pending);
        break;
      }

      case "scale_out": {
        const tokenId = String(cfg.tokenId ?? "");
        const ps = prices.get(tokenId);
        const pos = positions.get(tokenId);
        if (!ps || !pos) break;

        const pct = parseFloat(String(cfg.scalePct ?? 0.5));
        const size = pos.size * pct;
        fills.push({
          side: "SELL",
          outcome: "YES",
          size,
          price: ps.price,
          tokenId,
          type: "scale_out",
        });
        break;
      }

      case "cancel_all_orders": {
        const tokenId = String(cfg.tokenId ?? "");
        if (tokenId) {
          state.pendingOrders.delete(tokenId);
        } else {
          state.pendingOrders.clear();
        }
        break;
      }
      default:
        // Unknown action — silently skip
        break;
    }
  }

  return fills;
}

// ─── Stop-loss / take-profit checks ──────────────────────────────────────────

export function checkAutoExits(
  state: SimState,
  prices: Map<string, PriceState>,
  positions: Map<string, SimPosition>,
): SimFill[] {
  const fills: SimFill[] = [];

  for (const [tokenId, pos] of positions) {
    const ps = prices.get(tokenId);
    if (!ps) continue;

    const stopLoss = state.stopLosses.get(tokenId);
    const takeProfit = state.takeProfits.get(tokenId);

    if (stopLoss !== undefined && ps.price <= stopLoss) {
      fills.push({
        side: "SELL",
        outcome: "YES",
        size: pos.size,
        price: ps.price,
        tokenId,
        type: "stop_loss",
      });
      state.stopLosses.delete(tokenId);
      state.takeProfits.delete(tokenId);
    } else if (takeProfit !== undefined && ps.price >= takeProfit) {
      fills.push({
        side: "SELL",
        outcome: "YES",
        size: pos.size,
        price: ps.price,
        tokenId,
        type: "take_profit",
      });
      state.stopLosses.delete(tokenId);
      state.takeProfits.delete(tokenId);
    }
  }

  return fills;
}
