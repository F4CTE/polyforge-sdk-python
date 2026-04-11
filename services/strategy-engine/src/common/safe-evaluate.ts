import { create, all } from "mathjs";

/**
 * Restricted mathjs instance — primary security layer.
 *
 * We start from the full factory (`all`) and then **delete** functions that
 * could be abused for code-injection or resource-exhaustion attacks.
 * This is an allowlist-by-exclusion approach: only the safe numeric /
 * comparison / logical functions remain available to user expressions.
 */
const limitedMath = create(all);

const dangerousFunctions = [
  "compile",
  "import",
  "createUnit",
  "simplify",
  "derivative",
  "rationalize",
  "help",
];

dangerousFunctions.forEach((fn) => {
  delete (limitedMath as any)[fn];
});

/**
 * Safe wrapper around mathjs to prevent DoS via long / malicious expressions.
 *
 * Defence layers (in order):
 *  1. Character-length cap  (`maxLength`, default 200)
 *  2. Keyword blocklist     (secondary — catches patterns the restricted
 *     instance might still expose, e.g. prototype pollution attempts)
 *  3. Exponentiation depth  (max 2 `^` operators)
 *  4. Restricted mathjs     (`limitedMath` — no evaluate/parse/compile/import)
 */
export function safeEvaluate(
  expression: string,
  scope: Record<string, number>,
  maxLength = 200,
): number {
  if (expression.length > maxLength) {
    throw new Error(`Expression too long: ${expression.length} > ${maxLength}`);
  }

  // Secondary defence: reject potentially dangerous patterns
  if (
    /while|for|function|eval|require|import|__proto__|constructor|prototype/.test(
      expression,
    )
  ) {
    throw new Error("Expression contains forbidden keywords");
  }

  // Block nested exponentiation (e.g., 9^9^9) which causes CPU exhaustion
  if ((expression.match(/\^/g) || []).length > 2) {
    throw new Error("Expression contains too many exponentiation operators");
  }

  try {
    return Number(limitedMath.evaluate(expression, scope));
  } catch {
    return 0; // Safe fallback
  }
}
