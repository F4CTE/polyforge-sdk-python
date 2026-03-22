import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { X, GripVertical, Shield, Zap, Filter, Play } from 'lucide-react';
import type { BlockNodeData } from '../../../stores/builder-store';
import { useBuilderStore } from '../../../stores/builder-store';

type BlockNode = Node<BlockNodeData, 'blockNode'>;

interface StrategyOption {
  id: string;
  name: string;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  safety: <Shield className="size-3" />,
  triggers: <Zap className="size-3" />,
  conditions: <Filter className="size-3" />,
  actions: <Play className="size-3" />,
};

function BlockNodeInner({ id, data }: NodeProps<BlockNode>) {
  const d = data;
  const removeNode = useBuilderStore((s) => s.removeNode);
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
  const currentStrategyId = useBuilderStore((s) => s.strategyId);

  // Fetch user strategies for RUN_STRATEGY block's strategyId selector
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const isRunStrategy = d.type === 'RUN_STRATEGY';

  useEffect(() => {
    if (!isRunStrategy) return;
    fetch('/api/v1/strategies?limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        const list: StrategyOption[] = (res.data ?? [])
          .filter((s: any) => s.id !== currentStrategyId) // exclude self
          .map((s: any) => ({ id: s.id, name: s.name }));
        setStrategies(list);
      })
      .catch(() => setStrategies([]));
  }, [isRunStrategy, currentStrategyId]);

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

  /** Render a select field for strategy picker or mode picker */
  function renderSelectField(field: { key: string; label: string; placeholder: string; options?: string[] }) {
    // Strategy selector: fetch from API
    if (field.key === 'strategyId' && isRunStrategy) {
      return (
        <select
          value={d.config[field.key] ?? ''}
          onChange={(e) => onFieldChange(field.key, e.target.value)}
          className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
        >
          <option value="">{field.placeholder}</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      );
    }

    // Generic select with static options
    return (
      <select
        value={d.config[field.key] ?? ''}
        onChange={(e) => onFieldChange(field.key, e.target.value)}
        className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
      >
        <option value="">{field.placeholder}</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  }

  return (
    <>
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
        style={{ borderColor: d.color }}
      />

      <div
        className="w-[260px] rounded-pf-md shadow-pf-md overflow-hidden"
        style={{
          backgroundColor: 'var(--color-pf-elevated)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--color-pf-border)',
          color: 'var(--color-pf-text)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ backgroundColor: d.color + '18', borderBottom: `2px solid ${d.color}` }}
        >
          <GripVertical className="size-3 text-pf-text-muted cursor-grab" />
          <span className="text-pf-text-secondary">{SECTION_ICONS[d.section]}</span>
          <span className="text-xs font-medium text-pf-text flex-1 truncate">
            {d.label}
          </span>
          <button
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-red-500/20 text-pf-text-muted hover:text-red-400 transition-colors"
            title="Remove block"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Config fields */}
        {d.fields.length > 0 && (
          <div className="px-3 py-2 space-y-2">
            {d.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  renderSelectField(field)
                ) : (
                  <div className="relative">
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={d.config[field.key] ?? ''}
                      onChange={(e) => onFieldChange(field.key, e.target.value)}
                      className={`w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors ${
                        (d.config[field.key] ?? '').startsWith('$')
                          ? 'text-purple-400 font-mono'
                          : 'text-pf-text'
                      }`}
                    />
                    {(d.config[field.key] ?? '').startsWith('$') && (
                      <span
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-purple-400/70 pointer-events-none"
                        title={`Variable: ${d.config[field.key]}`}
                      >
                        var
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No fields message */}
        {d.fields.length === 0 && (
          <div className="px-3 py-2">
            <span className="text-[10px] text-pf-text-muted italic">No configuration needed</span>
          </div>
        )}
      </div>

      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
        style={{ borderColor: d.color }}
      />
    </>
  );
}

export const BlockNode = memo(BlockNodeInner);
