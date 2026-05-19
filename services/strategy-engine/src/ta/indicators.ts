// ─── Simple Moving Average ───────────────────────────────────────────────────

export function sma(prices: number[], period: number): number {
  if (prices.length < period || period <= 0) return NaN;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

// ─── Exponential Moving Average ──────────────────────────────────────────────

export function ema(prices: number[], period: number): number {
  if (prices.length < period || period <= 0) return NaN;
  const k = 2 / (period + 1);
  let value = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    value = prices[i] * k + value * (1 - k);
  }
  return value;
}

// ─── RSI (Wilder's smoothing) ─────────────────────────────────────────────────

export function rsiWilder(prices: number[], period: number): number {
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
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

export function macd(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): MacdResult {
  const nan = { macdLine: NaN, signalLine: NaN, histogram: NaN };
  if (
    !Number.isFinite(fast) ||
    !Number.isFinite(slow) ||
    !Number.isFinite(signal) ||
    !Number.isInteger(fast) ||
    !Number.isInteger(slow) ||
    !Number.isInteger(signal) ||
    fast <= 0 ||
    slow <= 0 ||
    signal <= 0 ||
    fast > slow
  ) {
    return nan;
  }
  if (prices.length < slow + signal - 1) return nan;

  // Build MACD line values across the series (one per bar after slow EMA is ready)
  const macdSeries: number[] = [];
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);

  let emaFast = prices.slice(0, fast).reduce((s, p) => s + p, 0) / fast;
  let emaSlow = prices.slice(0, slow).reduce((s, p) => s + p, 0) / slow;

  // Warm up fast EMA to match slow start index
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

  // Signal = EMA of MACD series
  const kSignal = 2 / (signal + 1);
  let signalEma =
    macdSeries.slice(0, signal).reduce((s, v) => s + v, 0) / signal;
  for (let i = signal; i < macdSeries.length; i++) {
    signalEma = macdSeries[i] * kSignal + signalEma * (1 - kSignal);
  }

  const macdLine = macdSeries[macdSeries.length - 1];
  return { macdLine, signalLine: signalEma, histogram: macdLine - signalEma };
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
}

export function bollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2,
): BollingerBandsResult {
  const nan = { upper: NaN, middle: NaN, lower: NaN };
  if (prices.length < period || period <= 0) return nan;

  const slice = prices.slice(-period);
  const middle = slice.reduce((s, p) => s + p, 0) / period;
  const variance = slice.reduce((s, p) => s + (p - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);

  return { upper: middle + stdDev * sd, middle, lower: middle - stdDev * sd };
}

// ─── Average True Range ───────────────────────────────────────────────────────

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
): number {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period + 1 || period <= 0) return NaN;

  // True ranges starting at index 1 (need prev close)
  const trs: number[] = [];
  for (let i = 1; i < len; i++) {
    const hl = highs[i] - lows[i];
    const hpc = Math.abs(highs[i] - closes[i - 1]);
    const lpc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hpc, lpc));
  }

  if (trs.length < period) return NaN;

  // Wilder's smoothing: seed with SMA of first `period` TRs
  let atrVal = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
  }
  return atrVal;
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

export function vwap(prices: number[], volumes: number[]): number {
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
