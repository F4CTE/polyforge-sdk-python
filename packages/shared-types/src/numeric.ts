export function isFiniteDecimal(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);

  const text = String(value).trim();
  if (text.length === 0) return false;

  return Number.isFinite(Number(text));
}

export function safeDecimalToNumber(value: unknown, fallback?: number): number {
  if (isFiniteDecimal(value)) return Number(String(value).trim());
  if (fallback !== undefined) return fallback;
  throw new Error(`Invalid finite decimal: ${String(value)}`);
}

export function parseFiniteDecimal(value: unknown): number | null {
  return isFiniteDecimal(value) ? Number(String(value).trim()) : null;
}

export function validateStopLossTakeProfitPct(
  pct: unknown,
  blockType: string,
): number {
  if (!isFiniteDecimal(pct)) {
    throw new Error(
      `Invalid ${blockType} pct: ${String(pct)} (must be a finite decimal)`,
    );
  }
  const num = Number(String(pct).trim());
  if (num <= 0 || num >= 1) {
    throw new Error(
      `Invalid ${blockType} pct: ${num} (must be > 0 and < 1, e.g. 0.1 for 10%)`,
    );
  }
  return num;
}
