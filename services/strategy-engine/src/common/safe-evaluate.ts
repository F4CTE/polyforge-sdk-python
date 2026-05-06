// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const { create, all } = require("mathjs");

/**
 * Restricted mathjs instance — primary security layer.
 *
 * Expressions are parsed, validated against a numeric AST allowlist, then
 * compiled. Validation blocks namespace escape hatches such as parse/chain.
 */
const limitedMath = create(all);

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
