use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Clone)]
pub struct BlockConfig {
    #[serde(flatten)]
    pub params: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize, Clone)]
pub struct Block {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: String,
    pub config: BlockConfig,
}

#[derive(Deserialize)]
pub struct EvalContext {
    pub current_price: f64,
    pub previous_price: Option<f64>,
    pub best_bid: f64,
    pub best_ask: f64,
    pub spread: f64,
    pub volume_24h: f64,
    pub daily_pnl: f64,
    pub total_exposure: f64,
    pub open_positions: u32,
    pub pending_orders: u32,
    pub consecutive_losses: u32,
    pub orders_today: u32,
    pub variables: std::collections::HashMap<String, f64>,
}

#[derive(Serialize)]
pub struct EvalResult {
    pub safety_passed: bool,
    pub safety_reason: Option<String>,
    pub triggered: bool,
    pub conditions_met: bool,
    pub actions: Vec<ActionIntent>,
}

#[derive(Serialize, Clone)]
pub struct ActionIntent {
    pub action_type: String,
    pub side: String,
    pub outcome: String,
    pub size: f64,
    pub price: f64,
}

// ─── Safety Evaluators ──────────────────────────────────

fn check_safety(blocks: &[Block], ctx: &EvalContext) -> (bool, Option<String>) {
    for block in blocks {
        match block.block_type.as_str() {
            "STOP_IF_DAILY_LOSS" => {
                let max_loss = get_f64(&block.config, "maxLoss", 0.0);
                if max_loss > 0.0 && ctx.daily_pnl <= -max_loss {
                    return (false, Some(format!("Daily loss ${:.2} exceeds limit ${:.2}", -ctx.daily_pnl, max_loss)));
                }
            }
            "MAX_ORDERS_TOTAL" => {
                let max = get_u32(&block.config, "maxOrders", 0);
                if max > 0 && ctx.orders_today >= max {
                    return (false, Some(format!("Orders today {} >= limit {}", ctx.orders_today, max)));
                }
            }
            "STOP_IF_CONSECUTIVE_LOSS" => {
                let max = get_u32(&block.config, "maxLosses", 0);
                if max > 0 && ctx.consecutive_losses >= max {
                    return (false, Some(format!("{} consecutive losses >= limit {}", ctx.consecutive_losses, max)));
                }
            }
            "STOP_IF_EXPOSURE_EXCEEDS" => {
                let max = get_f64(&block.config, "maxExposure", 0.0);
                if max > 0.0 && ctx.total_exposure >= max {
                    return (false, Some(format!("Exposure ${:.2} >= limit ${:.2}", ctx.total_exposure, max)));
                }
            }
            "MAX_BETS_PER_DAY" => {
                let max = get_u32(&block.config, "maxBets", 0);
                if max > 0 && ctx.orders_today >= max {
                    return (false, Some(format!("Bets today {} >= limit {}", ctx.orders_today, max)));
                }
            }
            "MAX_DRAWDOWN" => {
                let max = get_f64(&block.config, "maxDrawdown", 0.0);
                if max > 0.0 && ctx.daily_pnl <= -max {
                    return (false, Some(format!("Drawdown exceeds limit")));
                }
            }
            _ => { return (false, Some(format!("Unknown safety block type: {}", block.block_type))); }
        }
    }
    (true, None)
}

// ─── Trigger Evaluators ─────────────────────────────────

fn check_triggers(blocks: &[Block], ctx: &EvalContext) -> bool {
    if blocks.is_empty() { return true; } // No triggers = always fire

    for block in blocks {
        let fired = match block.block_type.as_str() {
            "EVERY_TICK" => true,
            "PRICE_ABOVE" => {
                let threshold = resolve_f64(&block.config, "threshold", ctx);
                ctx.current_price > threshold
            }
            "PRICE_BELOW" => {
                let threshold = resolve_f64(&block.config, "threshold", ctx);
                ctx.current_price < threshold
            }
            "PRICE_CROSSES_UP" => {
                let threshold = resolve_f64(&block.config, "threshold", ctx);
                let previous_price = ctx.previous_price.unwrap_or(ctx.current_price);
                previous_price < threshold && ctx.current_price >= threshold
            }
            "PRICE_CROSSES_DOWN" => {
                let threshold = resolve_f64(&block.config, "threshold", ctx);
                let previous_price = ctx.previous_price.unwrap_or(ctx.current_price);
                previous_price > threshold && ctx.current_price <= threshold
            }
            "SPREAD_BELOW" => {
                let threshold = resolve_f64(&block.config, "threshold", ctx);
                ctx.spread < threshold
            }
            "PRICE_IN_RANGE" => {
                let min = resolve_f64(&block.config, "min", ctx);
                let max = resolve_f64(&block.config, "max", ctx);
                ctx.current_price >= min && ctx.current_price <= max
            }
            _ => false,
        };
        if fired { return true; }
    }
    false
}

// ─── Condition Evaluators ───────────────────────────────

fn check_conditions(blocks: &[Block], ctx: &EvalContext) -> bool {
    if blocks.is_empty() { return true; }

    blocks.iter().all(|block| {
        match block.block_type.as_str() {
            "LIQUIDITY_ABOVE" => {
                let min = resolve_f64(&block.config, "minLiquidity", ctx);
                ctx.volume_24h > min
            }
            "SPREAD_BELOW_CONDITION" => {
                let max = resolve_f64(&block.config, "maxSpread", ctx);
                ctx.spread < max
            }
            "MAX_POSITION" => {
                let max = get_u32(&block.config, "maxPositions", 0);
                max == 0 || (ctx.open_positions + ctx.pending_orders) < max
            }
            "NO_EXISTING_POSITION" => ctx.open_positions == 0 && ctx.pending_orders == 0,
            "DAILY_LOSS_LIMIT" => {
                let limit = resolve_f64(&block.config, "limit", ctx);
                limit <= 0.0 || ctx.daily_pnl > -limit
            }
            _ => false, // Unknown condition — fail closed
        }
    })
}

// ─── Action Builder ─────────────────────────────────────

fn build_actions(blocks: &[Block], ctx: &EvalContext) -> Vec<ActionIntent> {
    let mut actions = Vec::new();

    for block in blocks {
        match block.block_type.as_str() {
            "BUY_YES" | "BUY_NO" | "SELL_YES" | "SELL_NO" => {
                let size = resolve_f64(&block.config, "size", ctx);
                let price = if block.block_type.contains("YES") { ctx.best_ask } else { ctx.best_bid };
                let (side, outcome) = match block.block_type.as_str() {
                    "BUY_YES" => ("BUY", "YES"),
                    "BUY_NO" => ("BUY", "NO"),
                    "SELL_YES" => ("SELL", "YES"),
                    "SELL_NO" => ("SELL", "NO"),
                    _ => continue,
                };
                actions.push(ActionIntent {
                    action_type: block.block_type.clone(),
                    side: side.to_string(),
                    outcome: outcome.to_string(),
                    size,
                    price,
                });
            }
            _ => {} // Other actions handled by TypeScript
        }
    }
    actions
}

// ─── Main Evaluator ─────────────────────────────────────

#[wasm_bindgen]
pub fn evaluate_tick(
    safety_json: &str,
    triggers_json: &str,
    conditions_json: &str,
    actions_json: &str,
    context_json: &str,
) -> Result<String, JsValue> {
    let safety: Vec<Block> = serde_json::from_str(safety_json)
        .map_err(|e| JsValue::from_str(&format!("Safety parse error: {}", e)))?;
    let triggers: Vec<Block> = serde_json::from_str(triggers_json)
        .map_err(|e| JsValue::from_str(&format!("Triggers parse error: {}", e)))?;
    let conditions: Vec<Block> = serde_json::from_str(conditions_json)
        .map_err(|e| JsValue::from_str(&format!("Conditions parse error: {}", e)))?;
    let action_blocks: Vec<Block> = serde_json::from_str(actions_json)
        .map_err(|e| JsValue::from_str(&format!("Actions parse error: {}", e)))?;
    let ctx: EvalContext = serde_json::from_str(context_json)
        .map_err(|e| JsValue::from_str(&format!("Context parse error: {}", e)))?;

    // 1. Safety check
    let (safety_passed, safety_reason) = check_safety(&safety, &ctx);
    if !safety_passed {
        return Ok(serde_json::to_string(&EvalResult {
            safety_passed: false,
            safety_reason,
            triggered: false,
            conditions_met: false,
            actions: vec![],
        }).unwrap());
    }

    // 2. Trigger check
    let triggered = check_triggers(&triggers, &ctx);
    if !triggered {
        return Ok(serde_json::to_string(&EvalResult {
            safety_passed: true,
            safety_reason: None,
            triggered: false,
            conditions_met: false,
            actions: vec![],
        }).unwrap());
    }

    // 3. Condition check
    let conditions_met = check_conditions(&conditions, &ctx);
    if !conditions_met {
        return Ok(serde_json::to_string(&EvalResult {
            safety_passed: true,
            safety_reason: None,
            triggered: true,
            conditions_met: false,
            actions: vec![],
        }).unwrap());
    }

    // 4. Build actions
    let actions = build_actions(&action_blocks, &ctx);

    Ok(serde_json::to_string(&EvalResult {
        safety_passed: true,
        safety_reason: None,
        triggered: true,
        conditions_met: true,
        actions,
    }).unwrap())
}

// ─── Helpers ────────────────────────────────────────────

fn get_f64(config: &BlockConfig, key: &str, default: f64) -> f64 {
    config.params.get(key)
        .and_then(|v| v.as_f64())
        .or_else(|| config.params.get(key).and_then(|v| v.as_str()).and_then(|s| s.parse().ok()))
        .unwrap_or(default)
}

fn get_u32(config: &BlockConfig, key: &str, default: u32) -> u32 {
    config.params.get(key)
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .or_else(|| config.params.get(key).and_then(|v| v.as_str()).and_then(|s| s.parse().ok()))
        .unwrap_or(default)
}

fn resolve_f64(config: &BlockConfig, key: &str, ctx: &EvalContext) -> f64 {
    if let Some(val) = config.params.get(key) {
        if let Some(s) = val.as_str() {
            if s.starts_with('$') {
                // Variable reference
                return *ctx.variables.get(&s[1..]).unwrap_or(&0.0);
            }
            return s.parse().unwrap_or(0.0);
        }
        return val.as_f64().unwrap_or(0.0);
    }
    0.0
}
