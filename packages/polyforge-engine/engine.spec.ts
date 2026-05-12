import { describe, it, expect } from 'vitest';
import { evaluateTick, type Block, type EvalContext, type EvalResult } from './index';

// ─── Test Helpers ───────────────────────────────────────

function makeContext(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    current_price: 0.65,
    best_bid: 0.64,
    best_ask: 0.66,
    spread: 0.02,
    volume_24h: 500_000,
    daily_pnl: 0,
    total_exposure: 1000,
    open_positions: 0,
    consecutive_losses: 0,
    orders_today: 0,
    variables: {},
    ...overrides,
  };
}

function makeBlock(type: string, config: Record<string, unknown> = {}): Block {
  return { id: `block-${type}`, type, config };
}

// ─── Safety Tests ───────────────────────────────────────

describe('Safety evaluators', () => {
  it('should stop when daily loss exceeds limit', () => {
    const safety = [makeBlock('STOP_IF_DAILY_LOSS', { maxLoss: 100 })];
    const ctx = makeContext({ daily_pnl: -150 });
    const result = evaluateTick(safety, [], [], [], ctx);

    expect(result.safety_passed).toBe(false);
    expect(result.safety_reason).toContain('exceeds limit');
    expect(result.actions).toHaveLength(0);
  });

  it('should pass when daily loss is within limit', () => {
    const safety = [makeBlock('STOP_IF_DAILY_LOSS', { maxLoss: 100 })];
    const ctx = makeContext({ daily_pnl: -50 });
    const result = evaluateTick(safety, [], [], [], ctx);

    expect(result.safety_passed).toBe(true);
  });

  it('should stop when max orders reached', () => {
    const safety = [makeBlock('MAX_ORDERS_TOTAL', { maxOrders: 10 })];
    const ctx = makeContext({ orders_today: 10 });
    const result = evaluateTick(safety, [], [], [], ctx);

    expect(result.safety_passed).toBe(false);
    expect(result.safety_reason).toContain('Orders today');
  });

  it('should stop on consecutive losses', () => {
    const safety = [makeBlock('STOP_IF_CONSECUTIVE_LOSS', { maxLosses: 3 })];
    const ctx = makeContext({ consecutive_losses: 5 });
    const result = evaluateTick(safety, [], [], [], ctx);

    expect(result.safety_passed).toBe(false);
    expect(result.safety_reason).toContain('consecutive losses');
  });

  it('should stop when exposure exceeds limit', () => {
    const safety = [makeBlock('STOP_IF_EXPOSURE_EXCEEDS', { maxExposure: 5000 })];
    const ctx = makeContext({ total_exposure: 6000 });
    const result = evaluateTick(safety, [], [], [], ctx);

    expect(result.safety_passed).toBe(false);
    expect(result.safety_reason).toContain('Exposure');
  });

  it('should fail closed on unknown safety block types', () => {
    const safety = [makeBlock('UNKNOWN_SAFETY_TYPE', {})];
    const ctx = makeContext();
    const result = evaluateTick(safety, [], [], [], ctx);

    expect(result.safety_passed).toBe(false);
    expect(result.safety_reason).toContain('Unknown safety block type');
  });
});

// ─── Trigger Tests ──────────────────────────────────────

describe('Trigger evaluators', () => {
  it('should fire when price is above threshold', () => {
    const triggers = [makeBlock('PRICE_ABOVE', { threshold: 0.60 })];
    const ctx = makeContext({ current_price: 0.65 });
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(true);
  });

  it('should not fire when price is below threshold', () => {
    const triggers = [makeBlock('PRICE_ABOVE', { threshold: 0.70 })];
    const ctx = makeContext({ current_price: 0.65 });
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(false);
  });

  it('should fire when price is below threshold', () => {
    const triggers = [makeBlock('PRICE_BELOW', { threshold: 0.70 })];
    const ctx = makeContext({ current_price: 0.65 });
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(true);
  });

  it('should fire on EVERY_TICK', () => {
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext();
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(true);
  });

  it('should fire when spread is below threshold', () => {
    const triggers = [makeBlock('SPREAD_BELOW', { threshold: 0.05 })];
    const ctx = makeContext({ spread: 0.02 });
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(true);
  });

  it('should fire when price is in range', () => {
    const triggers = [makeBlock('PRICE_IN_RANGE', { min: 0.60, max: 0.70 })];
    const ctx = makeContext({ current_price: 0.65 });
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(true);
  });

  it('should fire PRICE_CROSSES_UP only on an upward edge', () => {
    const triggers = [makeBlock('PRICE_CROSSES_UP', { threshold: 0.60 })];

    expect(
      evaluateTick(
        [],
        triggers,
        [],
        [],
        makeContext({ previous_price: 0.55, current_price: 0.60 }),
      ).triggered,
    ).toBe(true);
    expect(
      evaluateTick(
        [],
        triggers,
        [],
        [],
        makeContext({ previous_price: 0.65, current_price: 0.70 }),
      ).triggered,
    ).toBe(false);
  });

  it('should fire PRICE_CROSSES_DOWN only on a downward edge', () => {
    const triggers = [makeBlock('PRICE_CROSSES_DOWN', { threshold: 0.60 })];

    expect(
      evaluateTick(
        [],
        triggers,
        [],
        [],
        makeContext({ previous_price: 0.65, current_price: 0.60 }),
      ).triggered,
    ).toBe(true);
    expect(
      evaluateTick(
        [],
        triggers,
        [],
        [],
        makeContext({ previous_price: 0.55, current_price: 0.50 }),
      ).triggered,
    ).toBe(false);
  });

  it('does not fire crossing triggers on first tick without previous price', () => {
    const up = [makeBlock('PRICE_CROSSES_UP', { threshold: 0.60 })];
    const down = [makeBlock('PRICE_CROSSES_DOWN', { threshold: 0.60 })];

    expect(
      evaluateTick([], up, [], [], makeContext({ current_price: 0.70 }))
        .triggered,
    ).toBe(false);
    expect(
      evaluateTick([], down, [], [], makeContext({ current_price: 0.50 }))
        .triggered,
    ).toBe(false);
  });
});

// ─── Condition Tests ────────────────────────────────────

describe('Condition evaluators', () => {
  it('should require all conditions to pass', () => {
    const conditions = [
      makeBlock('LIQUIDITY_ABOVE', { minLiquidity: 100_000 }),
      makeBlock('NO_EXISTING_POSITION'),
    ];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext({ volume_24h: 500_000, open_positions: 0 });
    const result = evaluateTick([], triggers, conditions, [], ctx);

    expect(result.conditions_met).toBe(true);
  });

  it('should fail when any condition fails', () => {
    const conditions = [
      makeBlock('LIQUIDITY_ABOVE', { minLiquidity: 100_000 }),
      makeBlock('NO_EXISTING_POSITION'),
    ];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext({ volume_24h: 500_000, open_positions: 2 });
    const result = evaluateTick([], triggers, conditions, [], ctx);

    expect(result.conditions_met).toBe(false);
  });

  it('should enforce max position limit', () => {
    const conditions = [makeBlock('MAX_POSITION', { maxPositions: 3 })];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext({ open_positions: 3 });
    const result = evaluateTick([], triggers, conditions, [], ctx);

    expect(result.conditions_met).toBe(false);
  });

  it('should fail closed on unknown condition block types', () => {
    const conditions = [makeBlock('UNKNOWN_CONDITION_TYPE', {})];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext({});
    const result = evaluateTick([], triggers, conditions, [], ctx);

    expect(result.conditions_met).toBe(false);
  });
});

// ─── Action Tests ───────────────────────────────────────

describe('Action builder', () => {
  it('should generate BUY_YES action with correct intent', () => {
    const actions = [makeBlock('BUY_YES', { size: 50 })];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext({ best_ask: 0.66 });
    const result = evaluateTick([], triggers, [], actions, ctx);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action_type).toBe('BUY_YES');
    expect(result.actions[0].side).toBe('BUY');
    expect(result.actions[0].outcome).toBe('YES');
    expect(result.actions[0].size).toBe(50);
    expect(result.actions[0].price).toBe(0.66);
  });

  it('should generate BUY_NO action using best_bid price', () => {
    const actions = [makeBlock('BUY_NO', { size: 25 })];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext({ best_bid: 0.64 });
    const result = evaluateTick([], triggers, [], actions, ctx);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action_type).toBe('BUY_NO');
    expect(result.actions[0].side).toBe('BUY');
    expect(result.actions[0].outcome).toBe('NO');
    expect(result.actions[0].price).toBe(0.64);
  });

  it('should generate SELL_YES action', () => {
    const actions = [makeBlock('SELL_YES', { size: 30 })];
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext();
    const result = evaluateTick([], triggers, [], actions, ctx);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action_type).toBe('SELL_YES');
    expect(result.actions[0].side).toBe('SELL');
    expect(result.actions[0].outcome).toBe('YES');
  });
});

// ─── Variable Resolution Tests ──────────────────────────

describe('Variable resolution', () => {
  it('should resolve $varName from context variables', () => {
    const triggers = [makeBlock('PRICE_ABOVE', { threshold: '$targetPrice' })];
    const ctx = makeContext({
      current_price: 0.75,
      variables: { targetPrice: 0.70 },
    });
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.triggered).toBe(true);
  });

  it('should default to 0 for unknown variables', () => {
    const triggers = [makeBlock('PRICE_ABOVE', { threshold: '$unknown' })];
    const ctx = makeContext({ current_price: 0.05 });
    const result = evaluateTick([], triggers, [], [], ctx);

    // current_price 0.05 > 0.0 (default) = true
    expect(result.triggered).toBe(true);
  });
});

// ─── Empty Blocks Tests ─────────────────────────────────

describe('Empty blocks passthrough', () => {
  it('should pass safety with no safety blocks', () => {
    const ctx = makeContext();
    const result = evaluateTick([], [], [], [], ctx);

    expect(result.safety_passed).toBe(true);
  });

  it('should trigger with no trigger blocks', () => {
    const ctx = makeContext();
    const result = evaluateTick([], [], [], [], ctx);

    // No triggers = always fire (passthrough)
    expect(result.triggered).toBe(true);
  });

  it('should pass conditions with no condition blocks', () => {
    const triggers = [makeBlock('EVERY_TICK')];
    const ctx = makeContext();
    const result = evaluateTick([], triggers, [], [], ctx);

    expect(result.conditions_met).toBe(true);
  });
});

// ─── Full Pipeline Test ─────────────────────────────────

describe('Full evaluation pipeline', () => {
  it('should run safety → triggers → conditions → actions', () => {
    const safety = [makeBlock('STOP_IF_DAILY_LOSS', { maxLoss: 500 })];
    const triggers = [makeBlock('PRICE_ABOVE', { threshold: 0.60 })];
    const conditions = [
      makeBlock('LIQUIDITY_ABOVE', { minLiquidity: 100_000 }),
      makeBlock('NO_EXISTING_POSITION'),
    ];
    const actions = [makeBlock('BUY_YES', { size: 100 })];
    const ctx = makeContext({
      current_price: 0.65,
      best_ask: 0.66,
      daily_pnl: -100,
      volume_24h: 500_000,
      open_positions: 0,
    });

    const result = evaluateTick(safety, triggers, conditions, actions, ctx);

    expect(result.safety_passed).toBe(true);
    expect(result.triggered).toBe(true);
    expect(result.conditions_met).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].action_type).toBe('BUY_YES');
    expect(result.actions[0].size).toBe(100);
    expect(result.actions[0].price).toBe(0.66);
  });

  it('should short-circuit at safety failure', () => {
    const safety = [makeBlock('STOP_IF_DAILY_LOSS', { maxLoss: 50 })];
    const triggers = [makeBlock('EVERY_TICK')];
    const actions = [makeBlock('BUY_YES', { size: 100 })];
    const ctx = makeContext({ daily_pnl: -100 });

    const result = evaluateTick(safety, triggers, [], actions, ctx);

    expect(result.safety_passed).toBe(false);
    expect(result.triggered).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it('should short-circuit at trigger failure', () => {
    const triggers = [makeBlock('PRICE_ABOVE', { threshold: 0.90 })];
    const actions = [makeBlock('BUY_YES', { size: 100 })];
    const ctx = makeContext({ current_price: 0.65 });

    const result = evaluateTick([], triggers, [], actions, ctx);

    expect(result.safety_passed).toBe(true);
    expect(result.triggered).toBe(false);
    expect(result.conditions_met).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it('should short-circuit at condition failure', () => {
    const triggers = [makeBlock('EVERY_TICK')];
    const conditions = [makeBlock('NO_EXISTING_POSITION')];
    const actions = [makeBlock('BUY_YES', { size: 100 })];
    const ctx = makeContext({ open_positions: 2 });

    const result = evaluateTick([], triggers, conditions, actions, ctx);

    expect(result.safety_passed).toBe(true);
    expect(result.triggered).toBe(true);
    expect(result.conditions_met).toBe(false);
    expect(result.actions).toHaveLength(0);
  });
});
