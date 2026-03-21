/**
 * Resolve $variable references in block params.
 * If a param value is a string starting with $, look it up in variables.
 */
export function resolveParams(
  params: Record<string, unknown>,
  variables: Record<string, number>,
): Record<string, unknown> {
  const resolved = { ...params };
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string" && value.startsWith("$")) {
      const varName = value.slice(1);
      if (varName in variables) {
        resolved[key] = variables[varName];
      }
    }
  }
  return resolved;
}
