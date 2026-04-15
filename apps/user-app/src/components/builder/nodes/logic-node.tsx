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
  IF_THEN_ELSE: 'var(--warning)', // amber
  AND_GATE: 'var(--info)',     // blue
  OR_GATE: 'var(--info)',      // blue
  NOT_GATE: 'var(--info)',     // blue
  DELAY: 'var(--text-tertiary)', // gray
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

  const color = LOGIC_COLORS[d.type] ?? 'var(--info)';
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
          className="!w-3 !h-3 !bg-elevated !border-2 !rounded-pf-full builder-handle"
          style={{ '--node-color': color } as React.CSSProperties}
        />
      )}
      {inputCount === 2 && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="input-a"
            className="!w-3 !h-3 !bg-elevated !border-2 !rounded-pf-full builder-handle builder-handle--top"
            style={{ '--node-color': color } as React.CSSProperties}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="input-b"
            className="!w-3 !h-3 !bg-elevated !border-2 !rounded-pf-full builder-handle builder-handle--bottom"
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
          className="builder-node-header--solid flex items-center gap-2 px-3 py-2"
          style={{ '--node-color': color } as React.CSSProperties}
        >
          <GripVertical className="size-3 opacity-70 cursor-grab" />
          {icon}
          <span className="text-pf-label font-semibold flex-1 truncate">{symbol}</span>
          <span className="text-pf-micro opacity-70">{d.label}</span>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Remove block"
            title="Remove block"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Config fields (IF_THEN_ELSE has condition, DELAY has seconds) */}
        {d.fields.length > 0 && (
          <div className="px-3 py-2 space-y-2">
            {d.fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`${id}-${field.key}`} className="block text-pf-caption font-medium text-tertiary mb-1 uppercase tracking-wider">
                  {field.label}
                </label>
                <input
                  id={`${id}-${field.key}`}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={d.config[field.key] ?? ''}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  aria-label={field.label}
                  className={`w-full px-2 py-1 text-xs bg-surface border border-subtle rounded-pf-sm placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:border-accent/50 transition-colors ${
                    (d.config[field.key] ?? '').startsWith('$')
                      ? 'text-pf-purple-400 font-mono'
                      : 'text-primary'
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {/* No fields message for gates */}
        {d.fields.length === 0 && isCompact && (
          <div className="px-3 py-2">
            <span className="text-pf-caption text-tertiary italic">
              {d.type === 'AND_GATE' && 'True if all inputs are true'}
              {d.type === 'OR_GATE' && 'True if any input is true'}
              {d.type === 'NOT_GATE' && 'Inverts input'}
            </span>
          </div>
        )}

        {/* Condition preview for IF block */}
        {d.type === 'IF_THEN_ELSE' && d.config.condition && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 text-pf-caption">
              <span className="px-2 py-1 rounded-pf-full bg-gain/20 text-gain font-medium">
                TRUE
              </span>
              <span className="text-tertiary">/</span>
              <span className="px-2 py-1 rounded-pf-full bg-loss/20 text-loss font-medium">
                FALSE
              </span>
            </div>
          </div>
        )}

        {/* Delay preview */}
        {d.type === 'DELAY' && d.config.seconds && (
          <div className="px-3 pb-2">
            <span className="text-pf-caption text-tertiary">
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
            className="!w-3 !h-3 !bg-elevated !border-2 !rounded-pf-full builder-handle builder-handle--top"
            style={{ '--node-color': 'var(--gain)' } as React.CSSProperties}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false-out"
            className="!w-3 !h-3 !bg-elevated !border-2 !rounded-pf-full builder-handle builder-handle--bottom"
            style={{ '--node-color': 'var(--loss)' } as React.CSSProperties}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-3 !h-3 !bg-elevated !border-2 !rounded-pf-full builder-handle"
          style={{ '--node-color': color } as React.CSSProperties}
        />
      )}
    </>
  );
}

export const LogicNode = memo(LogicNodeInner);
