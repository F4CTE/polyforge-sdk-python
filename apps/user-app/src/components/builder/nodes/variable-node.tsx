import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Variable, X, GripVertical } from 'lucide-react';
import { useBuilderStore } from '../../../stores/builder-store';

// ─── Data shape ──────────────────────────────────────────────────────────────

export interface VariableNodeData {
  variableName: string;
  expression: string;
  [key: string]: unknown;
}

type VariableNodeType = Node<VariableNodeData, 'variableNode'>;

// ─── Constants ───────────────────────────────────────────────────────────────

const VARIABLE_COLOR = 'var(--color-pf-purple-500)';
const NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Validate a variable name: must be alphanumeric + underscore, starting with letter or underscore */
export function isValidVariableName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

/**
 * Minimal recursive-descent arithmetic parser.
 * Supports: +, -, *, /, %, parentheses, unary minus, decimals.
 * No dynamic code generation — safe from code injection.
 */
function safeArithmeticEval(expr: string): number | null {
  const tokens = expr.match(/(\d+(?:\.\d+)?|[+\-*/%()])/g);
  if (!tokens) return null;
  let pos = 0;

  function peek() { return tokens![pos]; }
  function consume() { return tokens![pos++]; }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parseFactor();
      if (op === '*') left *= right;
      else if (op === '/') left = right === 0 ? NaN : left / right;
      else left = right === 0 ? NaN : left % right;
    }
    return left;
  }

  function parseFactor(): number {
    if (peek() === '-') { consume(); return -parseFactor(); }
    if (peek() === '(') {
      consume(); // '('
      const val = parseExpr();
      if (peek() === ')') consume();
      return val;
    }
    const tok = consume();
    const n = Number(tok);
    return isNaN(n) ? NaN : n;
  }

  try {
    const result = parseExpr();
    if (pos < tokens.length) return null; // leftover tokens → malformed
    return isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Try to evaluate a simple expression for preview */
function tryEvaluate(expression: string): string | null {
  if (!expression.trim()) return null;
  if (!/^[\d\s+\-*/().%]+$/.test(expression)) return null;
  const result = safeArithmeticEval(expression);
  if (result === null) return null;
  return String(Math.round(result * 1e6) / 1e6);
}

// ─── Component ───────────────────────────────────────────────────────────────

function VariableNodeInner({ id, data }: NodeProps<VariableNodeType>) {
  const removeVariable = useBuilderStore((s) => s.removeVariable);
  const updateVariable = useBuilderStore((s) => s.updateVariable);

  const onDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeVariable(id);
    },
    [id, removeVariable],
  );

  const onNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateVariable(id, 'variableName', e.target.value);
    },
    [id, updateVariable],
  );

  const onExpressionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateVariable(id, 'expression', e.target.value);
    },
    [id, updateVariable],
  );

  const nameValid = useMemo(
    () => !data.variableName || isValidVariableName(data.variableName),
    [data.variableName],
  );

  const preview = useMemo(() => tryEvaluate(data.expression), [data.expression]);

  return (
    <>
      <div
        className="builder-node-card w-[200px] rounded-pf-md shadow-pf-md overflow-hidden"
        style={{ '--node-color': VARIABLE_COLOR } as React.CSSProperties}
      >
        {/* Header bar */}
        <div
          className="builder-node-header--solid flex items-center gap-2 px-3 py-2"
          style={{ '--node-color': VARIABLE_COLOR } as React.CSSProperties}
        >
          <GripVertical className="size-3 opacity-70 cursor-grab" />
          <Variable className="size-3" />
          <span className="text-pf-label font-semibold flex-1 truncate">Variable</span>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-pf-text/20 active:bg-pf-text/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-text/50"
            aria-label="Remove variable"
            title="Remove variable"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-3 py-2 space-y-2">
          {/* Name */}
          <div>
            <label htmlFor={`${id}-var-name`} className="block text-pf-caption font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Name
            </label>
            <input
              id={`${id}-var-name`}
              type="text"
              placeholder="myVar"
              value={data.variableName ?? ''}
              onChange={onNameChange}
              aria-describedby={!nameValid ? `${id}-name-error` : undefined}
              className={`w-full px-2 py-1 text-xs bg-pf-surface border rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus-visible:outline-none transition-colors ${
                nameValid
                  ? 'border-pf-border-subtle focus-visible:border-pf-purple-500/50'
                  : 'border-pf-danger/60 focus-visible:border-pf-danger'
              }`}
            />
            {!nameValid && (
              <p id={`${id}-name-error`} className="text-pf-micro text-pf-danger mt-1">
                Letters, digits, underscores only
              </p>
            )}
          </div>

          {/* Expression */}
          <div>
            <label htmlFor={`${id}-var-expr`} className="block text-pf-caption font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Expression
            </label>
            <input
              id={`${id}-var-expr`}
              type="text"
              placeholder="price * 0.95"
              value={data.expression ?? ''}
              onChange={onExpressionChange}
              aria-label="Variable expression"
              className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus-visible:outline-none focus-visible:border-pf-purple-500/50 transition-colors font-mono"
            />
          </div>

          {/* Preview */}
          {preview !== null && (
            <div className="builder-preview-chip text-pf-label font-mono px-2 py-1 rounded-pf-sm">
              = {preview}
            </div>
          )}
        </div>
      </div>

      {/* Source handle (right) — variables can wire to block inputs */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle"
        style={{ '--node-color': VARIABLE_COLOR } as React.CSSProperties}
      />
    </>
  );
}

export const VariableNode = memo(VariableNodeInner);
