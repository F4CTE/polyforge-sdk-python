type MathJsModule = {
  create: (
    factories: unknown,
    config?: Record<string, unknown>,
  ) => {
    import: (
      functions: Record<string, (...args: unknown[]) => unknown>,
      options: { override: boolean },
    ) => void;
    parse: (expression: string) => unknown;
  };
  all: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create, all } = require("mathjs") as MathJsModule;

/** Maximum absolute exponent value for pow() and ^ operator */
const MAX_EXPONENT = 1000;

/** Maximum absolute base value for pow() and ^ operator */
const MAX_POW_BASE = 1e12;

/** Maximum input for exp() before overflow to Infinity (~709 → 8.2e307) */
const MAX_EXP_INPUT = 709;

/**
 * Restricted mathjs instance — primary security layer.
 *
 * Expressions are parsed, validated against a numeric AST allowlist, then
 * compiled. Validation blocks namespace escape hatches such as parse/chain.
 *
 * pow() and exp() are overridden with bounded versions to prevent
 * CPU exhaustion and Infinity results from unreasonably large arguments.
 */
const limitedMath = create(all);

limitedMath.import(
  {
    pow(a: unknown, b: unknown): number {
      const base = Number(a);
      const exponent = Number(b);
      if (!Number.isFinite(base) || !Number.isFinite(exponent)) return NaN;
      if (Math.abs(base) > MAX_POW_BASE || Math.abs(exponent) > MAX_EXPONENT)
        return NaN;
      const result = Math.pow(base, exponent);
      return Number.isFinite(result) ? result : NaN;
    },
    exp(x: unknown): number {
      const input = Number(x);
      if (!Number.isFinite(input)) return NaN;
      if (input > MAX_EXP_INPUT) return NaN;
      const result = Math.exp(input);
      return Number.isFinite(result) ? result : NaN;
    },
  },
  { override: true },
);

const safeFunctions = new Set([
  "abs",
  "ceil",
  "cos",
  "exp",
  "floor",
  "log",
  "max",
  "min",
  "pow",
  "round",
  "sign",
  "sin",
  "sqrt",
  "tan",
]);

const safeOperators = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "==",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "and",
  "or",
  "not",
  "unaryMinus",
  "unaryPlus",
]);

const safeNodeTypes = new Set([
  "ConstantNode",
  "FunctionNode",
  "OperatorNode",
  "ParenthesisNode",
  "SymbolNode",
]);

const safeConstants: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
};

interface MathNodeLike {
  type: string;
  name?: string;
  fn?: MathNodeLike;
  op?: string;
  forEach?: (callback: (child: MathNodeLike) => void) => void;
  compile: () => { evaluate: (scope: Record<string, number>) => unknown };
}

function validateNode(node: MathNodeLike, scope: Record<string, number>) {
  if (!safeNodeTypes.has(node.type)) {
    throw new Error(`Expression contains unsupported node: ${node.type}`);
  }

  if (node.type === "SymbolNode") {
    const name = node.name ?? "";
    if (
      !(name in scope) &&
      !(name in safeConstants) &&
      !safeFunctions.has(name)
    ) {
      throw new Error(`Expression references unknown symbol: ${node.name}`);
    }
  }

  if (node.type === "OperatorNode" && !safeOperators.has(node.op ?? "")) {
    throw new Error(`Expression contains unsupported operator: ${node.op}`);
  }

  if (node.type === "FunctionNode") {
    const fnName = node.fn?.type === "SymbolNode" ? node.fn.name : undefined;
    if (!fnName || !safeFunctions.has(fnName)) {
      throw new Error(`Expression contains unsupported function: ${fnName}`);
    }
  }

  node.forEach?.((child) => validateNode(child, scope));
}

/**
 * Safe wrapper around mathjs to prevent DoS via long / malicious expressions.
 *
 * Invalid, unsupported, or non-finite expressions return NaN so callers cannot
 * confuse a failure with the valid numeric result 0.
 */
export function safeEvaluate(
  expression: string,
  scope: Record<string, number>,
  maxLength = 200,
): number {
  if (expression.length > maxLength) {
    return NaN;
  }

  // Secondary defence: reject potentially dangerous patterns
  if (
    /while|for|function|eval|require|import|parse|chain|derivative|expression|__proto__|constructor|prototype/.test(
      expression,
    )
  ) {
    return NaN;
  }

  // Block nested exponentiation (e.g., 9^9^9) which causes CPU exhaustion
  if ((expression.match(/\^/g) || []).length > 2) {
    return NaN;
  }

  try {
    const node = limitedMath.parse(expression) as MathNodeLike;
    const fullScope = { ...safeConstants, ...scope };
    validateNode(node, fullScope);
    const value = Number(node.compile().evaluate(fullScope));
    return Number.isFinite(value) ? value : NaN;
  } catch {
    return NaN;
  }
}
