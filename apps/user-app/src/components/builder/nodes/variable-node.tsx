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

/** Try to evaluate a simple expression for preview */
function tryEvaluate(expression: string): string | null {
  if (!expression.trim()) return null;
  try {
    // Only evaluate simple arithmetic expressions (no function calls, no assignments)
    if (/^[\d\s+\-*/().%]+$/.test(expression)) {
      // eslint-disable-next-line no-eval
      const result = new Function(`"use strict"; return (${expression})`)();
      if (typeof result === 'number' && isFinite(result)) {
        return String(Math.round(result * 1e6) / 1e6);
      }
    }
  } catch {
    // Evaluation failed — that's fine, just don't show a preview
  }
  return null;
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
        className="w-[200px] rounded-pf-md shadow-pf-md overflow-hidden"
        style={{
          backgroundColor: 'var(--color-pf-elevated)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: VARIABLE_COLOR + '60',
          color: 'var(--color-pf-text)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5"
          style={{ backgroundColor: VARIABLE_COLOR, color: 'white' }}
        >
          <GripVertical className="size-3 opacity-70 cursor-grab" />
          <Variable className="size-3" />
          <span className="text-[11px] font-semibold flex-1 truncate">Variable</span>
          <button
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Remove variable"
            title="Remove variable"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-2.5 py-2 space-y-2">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              placeholder="myVar"
              value={data.variableName ?? ''}
              onChange={onNameChange}
              className={`w-full px-2 py-1 text-xs bg-pf-surface border rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none transition-colors ${
                nameValid
                  ? 'border-pf-border-subtle focus:border-pf-purple-500/50'
                  : 'border-pf-danger/60 focus:border-pf-danger'
              }`}
            />
            {!nameValid && (
              <p className="text-[9px] text-pf-danger mt-0.5">
                Letters, digits, underscores only
              </p>
            )}
          </div>

          {/* Expression */}
          <div>
            <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
              Expression
            </label>
            <input
              type="text"
              placeholder="price * 0.95"
              value={data.expression ?? ''}
              onChange={onExpressionChange}
              className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-purple-500/50 transition-colors font-mono"
            />
          </div>

          {/* Preview */}
          {preview !== null && (
            <div
              className="text-[11px] font-mono px-2 py-1 rounded-pf-sm"
              style={{ backgroundColor: VARIABLE_COLOR + '15', color: VARIABLE_COLOR }}
            >
              = {preview}
            </div>
          )}
        </div>
      </div>

      {/* Source handle (right) — variables can wire to block inputs */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
        style={{ borderColor: VARIABLE_COLOR }}
      />
    </>
  );
}

export const VariableNode = memo(VariableNodeInner);
