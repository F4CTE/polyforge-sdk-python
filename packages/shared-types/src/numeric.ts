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
