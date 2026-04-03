import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { X, GripVertical, GitBranch, Combine, Ban, Timer } from 'lucide-react';
import type { LogicNodeData } from '../../../stores/builder-store';
import { useBuilderStore } from '../../../stores/builder-store';

type LogicNode = Node<LogicNodeData, 'logicNode'>;

// ─── Type-specific config ───────────────────────────────────────────────────

const LOGIC_ICONS: Record<string, React.ReactNode> = {
  IF_THEN_ELSE: <GitBranch className="size-3" />,
  AND_GATE: <Combine className="size-3" />,
  OR_GATE: <Combine className="size-3" />,
  NOT_GATE: <Ban className="size-3" />,
  DELAY: <Timer className="size-3" />,
};

const LOGIC_SYMBOLS: Record<string, string> = {
  IF_THEN_ELSE: 'IF',
  AND_GATE: '&',
  OR_GATE: '||',
  NOT_GATE: '!',
  DELAY: 'Wait',
};

const LOGIC_COLORS: Record<string, string> = {
  IF_THEN_ELSE: 'var(--color-pf-warning)', // amber
  AND_GATE: 'var(--color-pf-info)',     // blue
  OR_GATE: 'var(--color-pf-info)',      // blue
  NOT_GATE: 'var(--color-pf-info)',     // blue
  DELAY: 'var(--color-pf-text-muted)', // gray
};

/** Number of input handles per logic type */
const INPUT_COUNTS: Record<string, number> = {
  IF_THEN_ELSE: 1,
  AND_GATE: 2,
  OR_GATE: 2,
  NOT_GATE: 1,
  DELAY: 1,
};

// ─── Component ──────────────────────────────────────────────────────────────

function LogicNodeInner({ id, data }: NodeProps<LogicNode>) {
  const d = data;
  const removeNode = useBuilderStore((s) => s.removeNode);
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);

  const onDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeNode(id);
    },
    [id, removeNode],
  );

  const onFieldChange = useCallback(
    (key: string, value: string) => {
      updateNodeConfig(id, key, value);
    },
    [id, updateNodeConfig],
  );

  const color = LOGIC_COLORS[d.type] ?? 'var(--color-pf-info)';
  const symbol = LOGIC_SYMBOLS[d.type] ?? d.type;
  const icon = LOGIC_ICONS[d.type];
  const inputCount = INPUT_COUNTS[d.type] ?? 1;
  const hasMultiOutput = d.outputs && d.outputs.length > 1;
  const isCompact = d.type === 'NOT_GATE' || (d.type === 'AND_GATE') || (d.type === 'OR_GATE');
  const width = isCompact ? 160 : 220;

  return (
    <>
      {/* Input handles (left side) */}
      {inputCount === 1 && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle"
          style={{ '--node-color': color } as React.CSSProperties}
        />
      )}
      {inputCount === 2 && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="input-a"
            className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle builder-handle--top"
            style={{ '--node-color': color } as React.CSSProperties}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="input-b"
            className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle builder-handle--bottom"
            style={{ '--node-color': color } as React.CSSProperties}
          />
        </>
      )}

      <div
        className={`builder-node-card rounded-pf-md shadow-pf-md overflow-hidden ${isCompact ? 'w-[160px]' : 'w-[220px]'}`}
        style={{ '--node-color': color } as React.CSSProperties}
      >
        {/* Header bar */}
        <div
          className="builder-node-header--solid flex items-center gap-1.5 px-2.5 py-1.5"
          style={{ '--node-color': color } as React.CSSProperties}
        >
          <GripVertical className="size-3 opacity-70 cursor-grab" />
          {icon}
          <span className="text-pf-label font-bold flex-1 truncate">{symbol}</span>
          <span className="text-pf-micro opacity-70">{d.label}</span>
          <button
            type="button"
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Remove block"
            title="Remove block"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Config fields (IF_THEN_ELSE has condition, DELAY has seconds) */}
        {d.fields.length > 0 && (
          <div className="px-2.5 py-2 space-y-2">
            {d.fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`${id}-${field.key}`} className="block text-pf-caption font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                  {field.label}
                </label>
                <input
                  id={`${id}-${field.key}`}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={d.config[field.key] ?? ''}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  aria-label={field.label}
                  className={`w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors ${
                    (d.config[field.key] ?? '').startsWith('$')
                      ? 'text-pf-purple-400 font-mono'
                      : 'text-pf-text'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {/* No fields message for gates */}
        {d.fields.length === 0 && isCompact && (
          <div className="px-2.5 py-1.5">
            <span className="text-pf-caption text-pf-text-muted italic">
              {d.type === 'AND_GATE' && 'True if all inputs are true'}
              {d.type === 'OR_GATE' && 'True if any input is true'}
              {d.type === 'NOT_GATE' && 'Inverts input'}
            </span>
          </div>
        )}

        {/* Condition preview for IF block */}
        {d.type === 'IF_THEN_ELSE' && d.config.condition && (
          <div className="px-2.5 pb-2">
            <div className="flex items-center gap-2 text-pf-caption">
              <span className="px-1.5 py-0.5 rounded-pf-full bg-pf-success/20 text-pf-success font-medium">
                TRUE
              </span>
              <span className="text-pf-text-muted">/</span>
              <span className="px-1.5 py-0.5 rounded-pf-full bg-pf-danger/20 text-pf-danger font-medium">
                FALSE
              </span>
            </div>
          </div>
        )}

        {/* Delay preview */}
        {d.type === 'DELAY' && d.config.seconds && (
          <div className="px-2.5 pb-2">
            <span className="text-pf-caption text-pf-text-muted">
              Wait {d.config.seconds}s
            </span>
          </div>
        )}
      </div>

      {/* Output handles (right side) */}
      {hasMultiOutput ? (
        <>
          {/* IF_THEN_ELSE: true (green, top) and false (red, bottom) */}
          <Handle
            type="source"
            position={Position.Right}
            id="true-out"
            className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle builder-handle--top"
            style={{ '--node-color': 'var(--color-pf-success)' } as React.CSSProperties}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false-out"
            className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle builder-handle--bottom"
            style={{ '--node-color': 'var(--color-pf-danger)' } as React.CSSProperties}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full builder-handle"
          style={{ '--node-color': color } as React.CSSProperties}
        />
      )}
    </>
  );
}

export const LogicNode = memo(LogicNodeInner);
