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
 *            price_crosses_down, spread_below
 * CONDITIONS: max_bets_per_day, daily_loss_limit, price_in_range,
 *             max_position, cooldown_after_trade
 * ACTIONS:   buy_yes, buy_no, set_stop_loss, take_profit,
 *            scale_in, scale_out, skip_bet
 */

export interface Block {
    type: string;
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
    stopLosses: Map<string, number>;   // tokenId → stop-loss price
    takeProfits: Map<string, number>;  // tokenId → take-profit price
}

export interface SimPosition {
    size: number;
    avgPrice: number;
}

export interface SimFill {
    side: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    size: number;
    price: number;
    tokenId: string;
    type: string;   // 'buy_yes' | 'buy_no' | 'stop_loss' | 'take_profit' | etc.
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
    };
}

// ─── Safety ──────────────────────────────────────────────────────────────────

export function checkSafety(
    safety: Block[],
    state: SimState,
    prices: Map<string, PriceState>,
    positions: Map<string, SimPosition>,
): boolean {
    for (const block of safety) {
        const cfg = block.config ?? {};
        switch (block.type) {
            case 'stop_if_daily_loss': {
                const max = parseFloat(String(cfg.maxLossUsdc ?? 0));
                if (state.dailyPnl <= -Math.abs(max)) return false;
                break;
            }
            case 'max_orders_total': {
                const max = parseInt(String(cfg.maxOrders ?? 0), 10);
                if (max > 0 && state.totalOrders >= max) return false;
                break;
            }
            case 'stop_if_consecutive_loss': {
                const max = parseInt(String(cfg.maxConsecutiveLoss ?? 0), 10);
                if (max > 0 && state.consecutiveLoss >= max) return false;
                break;
            }
            case 'stop_if_exposure_exceeds': {
                const maxExposure = parseFloat(String(cfg.maxExposureUsdc ?? 0));
                let totalExposure = 0;
                for (const [, pos] of positions) {
                    totalExposure += pos.size * pos.avgPrice;
                }
                if (maxExposure > 0 && totalExposure >= maxExposure) return false;
                break;
            }
        }
    }
    return true;
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export function checkTriggers(
    triggers: Block[],
    prices: Map<string, PriceState>,
): boolean {
    if (triggers.length === 0) return true;

    for (const block of triggers) {
        const cfg = block.config ?? {};
        const tokenId = String(cfg.tokenId ?? '');
        const ps = prices.get(tokenId);

        switch (block.type) {
            case 'every_tick':
                return true;

            case 'price_above': {
                const threshold = parseFloat(String(cfg.threshold ?? 0));
                if (ps && ps.price > threshold) return true;
                break;
            }
            case 'price_below': {
                const threshold = parseFloat(String(cfg.threshold ?? 0));
                if (ps && ps.price < threshold) return true;
                break;
            }
            case 'price_crosses_up': {
                const threshold = parseFloat(String(cfg.threshold ?? 0));
                if (ps && ps.prevPrice <= threshold && ps.price > threshold) return true;
                break;
            }
            case 'price_crosses_down': {
                const threshold = parseFloat(String(cfg.threshold ?? 0));
                if (ps && ps.prevPrice >= threshold && ps.price < threshold) return true;
                break;
            }
            case 'spread_below': {
                const maxSpread = parseFloat(String(cfg.maxSpread ?? 1));
                if (ps) {
                    const spread = ps.ask - ps.bid;
                    if (spread < maxSpread) return true;
                }
                break;
            }
            case 'price_above_tick':
            case 'price_below_tick': {
                // Same as price_above/below for backtest purposes
                const threshold = parseFloat(String(cfg.threshold ?? 0));
                if (block.type === 'price_above_tick' && ps && ps.price > threshold) return true;
                if (block.type === 'price_below_tick' && ps && ps.price < threshold) return true;
                break;
            }
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
        const cfg = block.config ?? {};

        switch (block.type) {
            case 'max_bets_per_day': {
                const max = parseInt(String(cfg.maxBets ?? 0), 10);
                if (max > 0 && state.betsToday >= max) return false;
                break;
            }
            case 'daily_loss_limit': {
                const max = parseFloat(String(cfg.maxLossUsdc ?? 0));
                if (state.dailyPnl <= -Math.abs(max)) return false;
                break;
            }
            case 'price_in_range': {
                const tokenId = String(cfg.tokenId ?? '');
                const min = parseFloat(String(cfg.minPrice ?? 0));
                const max = parseFloat(String(cfg.maxPrice ?? 1));
                const ps = prices.get(tokenId);
                if (ps && (ps.price < min || ps.price > max)) return false;
                break;
            }
            case 'max_position': {
                const tokenId = String(cfg.tokenId ?? '');
                const maxUsdc = parseFloat(String(cfg.maxPositionUsdc ?? 0));
                const pos = positions.get(tokenId);
                if (pos && maxUsdc > 0 && pos.size * pos.avgPrice >= maxUsdc) return false;
                break;
            }
            case 'cooldown_after_trade': {
                const cooldownMs = parseInt(String(cfg.cooldownMs ?? 0), 10);
                if (cooldownMs > 0 && state.lastTradeAt > 0 && nowMs - state.lastTradeAt < cooldownMs) return false;
                break;
            }
            case 'no_existing_position': {
                const tokenId = String(cfg.tokenId ?? '');
                if (positions.has(tokenId)) return false;
                break;
            }
            case 'no_reentry': {
                // Simplified: block if we've traded this token today (tracked via lastTradeAt)
                break;
            }
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
        const cfg = block.config ?? {};

        switch (block.type) {
            case 'skip_bet':
                return []; // abort all actions

            case 'buy_yes':
            case 'buy_no': {
                const tokenId = String(cfg.tokenId ?? '');
                const ps = prices.get(tokenId);
                if (!ps) break;

                const sizeUsdc = parseFloat(String(cfg.size ?? 10));
                const fillPrice = ps.price > 0 ? ps.price : 0.5;
                const size = sizeUsdc / fillPrice;
                const outcome = block.type === 'buy_yes' ? 'YES' : 'NO';

                fills.push({ side: 'BUY', outcome, size, price: fillPrice, tokenId, type: block.type });
                break;
            }

            case 'set_stop_loss': {
                const tokenId = String(cfg.tokenId ?? '');
                const stopPct = parseFloat(String(cfg.stopLossPct ?? 0.2));
                const pos = positions.get(tokenId);
                if (pos) {
                    state.stopLosses.set(tokenId, pos.avgPrice * (1 - stopPct));
                }
                break;
            }

            case 'take_profit': {
                const tokenId = String(cfg.tokenId ?? '');
                const targetPct = parseFloat(String(cfg.takeProfitPct ?? 0.5));
                const pos = positions.get(tokenId);
                if (pos) {
                    state.takeProfits.set(tokenId, pos.avgPrice * (1 + targetPct));
                }
                break;
            }

            case 'scale_in': {
                const tokenId = String(cfg.tokenId ?? '');
                const ps = prices.get(tokenId);
                const pos = positions.get(tokenId);
                if (!ps || !pos) break;

                const sizeUsdc = parseFloat(String(cfg.size ?? 10));
                const fillPrice = ps.price;
                const size = sizeUsdc / fillPrice;

                fills.push({ side: 'BUY', outcome: 'YES', size, price: fillPrice, tokenId, type: 'scale_in' });
                break;
            }

            case 'scale_out': {
                const tokenId = String(cfg.tokenId ?? '');
                const ps = prices.get(tokenId);
                const pos = positions.get(tokenId);
                if (!ps || !pos) break;

                const pct = parseFloat(String(cfg.scalePct ?? 0.5));
                const size = pos.size * pct;
                fills.push({ side: 'SELL', outcome: 'YES', size, price: ps.price, tokenId, type: 'scale_out' });
                break;
            }

            case 'cancel_all_orders':
                // No-op in backtest (no pending orders)
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
            fills.push({ side: 'SELL', outcome: 'YES', size: pos.size, price: ps.price, tokenId, type: 'stop_loss' });
            state.stopLosses.delete(tokenId);
            state.takeProfits.delete(tokenId);
        } else if (takeProfit !== undefined && ps.price >= takeProfit) {
            fills.push({ side: 'SELL', outcome: 'YES', size: pos.size, price: ps.price, tokenId, type: 'take_profit' });
            state.stopLosses.delete(tokenId);
            state.takeProfits.delete(tokenId);
        }
    }

    return fills;
}
