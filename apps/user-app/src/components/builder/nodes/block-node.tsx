import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { X, GripVertical, Shield, Zap, Filter, Play, Unlink, Globe, AlertTriangle, Link2 } from 'lucide-react';
import type { BlockNodeData } from '../../../stores/builder-store';
import { useBuilderStore } from '../../../stores/builder-store';
import { useExecutionStore } from '../../../stores/execution-store';

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
  const isLive = useExecutionStore((s) => s.liveRunning);
  const isBtRunning = useExecutionStore((s) => s.backtestRunning);
  const isExecuting = isLive || isBtRunning;
  const hasFired = useExecutionStore((s) => s.firedBlockIds.has(id));

  const edges = useBuilderStore((s) => s.edges);
  const nodes = useBuilderStore((s) => s.nodes);
  const isSafety = d.section === 'safety';
  const isCondition = d.section === 'conditions';
  const isTrigger = d.section === 'triggers';
  const isAction = d.section === 'actions';
  const hasEdge = edges.some((e) => e.source === id || e.target === id);

  // Wiring semantics:
  //   safety     → always active (global guard, no handles)
  //   conditions → always active; unwired = global gate, wired = scoped inline
  //   triggers   → only active when wired (needs an outgoing path)
  //   actions    → only active when wired (needs upstream context)
  const isGlobal = (isSafety || isCondition) && !hasEdge;
  const isInactive = (isTrigger || isAction) && !hasEdge;

  // Whether to show target/source handles per section
  const showTargetHandle = isCondition || isAction;
  const showSourceHandle = isTrigger || isCondition;

  // ── Wireable field connections ────────────────────────────────────────────
  // For safety blocks with wireable fields, track which fields have a Variable
  // or Calc node wired into them (via a data edge targeting handle = field.key).
  const wireableConnections = useMemo(() => {
    const map = new Map<string, string>(); // fieldKey → source node label
    if (!isSafety) return map;
    for (const field of d.fields) {
      if (!field.wireable) continue;
      const edge = edges.find((e) => e.target === id && e.targetHandle === field.key);
      if (!edge) continue;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const label = sourceNode
        ? ((sourceNode.data as Record<string, unknown>).variableName ||
           (sourceNode.data as Record<string, unknown>).label ||
           'Connected') as string
        : 'Connected';
      map.set(field.key, label);
    }
    return map;
  }, [isSafety, d.fields, edges, nodes, id]);

  // ── Validation ────────────────────────────────────────────────────────────
  // Collect keys of fields that have no value set yet.
  // Connected wireable fields are treated as filled (value comes from the wire).
  const emptyFieldKeys = new Set(
    d.fields
      .filter((f) => !wireableConnections.has(f.key) && !(d.config[f.key] ?? ''))
      .map((f) => f.key),
  );
  const isMisconfigured = emptyFieldKeys.size > 0;

  // Show the "Setup needed" badge only for active (non-inactive, non-global) blocks
  // with empty fields — avoids stacking with "Not wired" / "Global" badges.
  // Field-level highlights still appear in all states.
  const showSetupBadge = isMisconfigured && !isInactive && !isGlobal;

  // Fetch user strategies for RUN_STRATEGY block's strategyId selector
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const isRunStrategy = d.type === 'RUN_STRATEGY';

  useEffect(() => {
    if (!isRunStrategy) return;
    fetch('/api/v1/strategies?limit=50', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        const list: StrategyOption[] = ((res.data ?? []) as { id: string; name: string }[])
          .filter((s) => s.id !== currentStrategyId)
          .map((s) => ({ id: s.id, name: s.name }));
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

  // ── Border & animation logic ──────────────────────────────────────────────
  // Priority: fired > executing > inactive > setup-needed > normal
  const borderColor = hasFired
    ? 'color-mix(in srgb, var(--accent-default) 90%, transparent)'
    : isExecuting
    ? `color-mix(in srgb, ${d.color} 38%, transparent)`
    : isInactive
    ? 'color-mix(in srgb, var(--warning) 27%, transparent)'
    : showSetupBadge
    ? 'color-mix(in srgb, var(--loss) 33%, transparent)'
    : 'var(--border-subtle)';

  // Pulse animation speed varies by section to convey different "rhythms":
  // triggers scan rapidly, safety beats slowly like a heartbeat
  const PULSE_DURATION: Record<string, string> = {
    triggers:   'var(--duration-builder-triggers)',
    actions:    'var(--duration-builder-actions)',
    conditions: 'var(--duration-builder-conditions)',
    logic:      'var(--duration-builder-logic)',
    calc:       'var(--duration-builder-calc)',
    safety:     'var(--duration-builder-safety)',
  };
  const pulseKeyframe = d.section === 'safety' ? 'safetyPulse' : 'blockPulse';
  const pulseDuration = PULSE_DURATION[d.section] ?? 'var(--duration-builder-logic)';

  const cardAnimation = hasFired
    ? 'blockFired var(--duration-builder-fired) ease-out forwards'
    : isExecuting && !isInactive
    ? `${pulseKeyframe} ${pulseDuration} ease-in-out infinite`
    : undefined;

  /** Render a select field for strategy picker or mode picker */
  function renderSelectField(field: { key: string; label: string; placeholder: string; options?: string[] }) {
    const isEmpty = emptyFieldKeys.has(field.key);
    const selectClass = `w-full px-2 py-1 text-label bg-surface border rounded-sm text-primary focus-visible:outline-none focus-visible:border-accent/50 transition-colors ${
      isEmpty ? 'border-loss/40 bg-loss-subtle' : 'border-subtle'
    }`;

    if (field.key === 'strategyId' && isRunStrategy) {
      return (
        <select
          value={d.config[field.key] ?? ''}
          onChange={(e) => onFieldChange(field.key, e.target.value)}
          aria-label="Select strategy"
          className={selectClass}
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

    return (
      <select
        value={d.config[field.key] ?? ''}
        onChange={(e) => onFieldChange(field.key, e.target.value)}
        aria-label={field.label}
        className={selectClass}
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
      {/* Target handle (left) — triggers and safety have no incoming connections */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-elevated !border-2 !rounded-full builder-handle"
          style={{ '--node-color': d.color } as React.CSSProperties}
        />
      )}

      <div className="relative">
        {/* "Global" badge — safety/conditions when unwired: active globally */}
        {isGlobal && (
          <div
            className="builder-badge absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full text-caption font-semibold whitespace-nowrap z-10 pointer-events-none"
            style={{ '--badge-color': 'var(--accent-default)' } as React.CSSProperties}
            title={isSafety ? 'Safety block — always enforced globally on every tick' : 'Condition block — no connections, acts as a global gate for all execution paths. Wire it to scope it to a specific path.'}
          >
            <Globe className="size-3" />
            Global
          </div>
        )}

        {/* "Not wired" badge — triggers/actions with no edges: inactive */}
        {isInactive && (
          <div
            className="builder-badge absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full text-caption font-semibold whitespace-nowrap z-10 pointer-events-none"
            style={{ '--badge-color': 'var(--chart-category-3)' } as React.CSSProperties}
            title={isTrigger ? 'Trigger has no outgoing connection — wire it to a condition or action to activate it' : 'Action has no incoming connection — wire a trigger or condition to it to activate it'}
          >
            <Unlink className="size-3" />
            Not wired
          </div>
        )}

        {/* "Setup needed" badge — active block with one or more empty required fields */}
        {showSetupBadge && (
          <div
            className="builder-badge absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full text-caption font-semibold whitespace-nowrap z-10 pointer-events-none"
            style={{ '--badge-color': 'var(--loss)' } as React.CSSProperties}
            title={`${emptyFieldKeys.size} required field${emptyFieldKeys.size !== 1 ? 's' : ''} not filled in`}
          >
            <AlertTriangle className="size-3" />
            Setup needed
          </div>
        )}

        <div
          className={`builder-node-card w-[260px] rounded-lg shadow-md overflow-hidden ${isInactive ? 'opacity-45 builder-node-card--dashed' : ''} ${(isExecuting || hasFired) ? 'builder-node-card--executing' : ''} ${showSetupBadge && !isExecuting && !hasFired ? 'builder-node-card--setup-needed' : ''}`}
          style={{
            '--node-color': borderColor,
            borderColor,
            animation: cardAnimation,
          } as React.CSSProperties}
        >
          {/* Header bar */}
          <div
            className="builder-node-header flex items-center gap-2 px-3 py-2"
            style={{ '--node-color': d.color } as React.CSSProperties}
          >
            <GripVertical className="size-3 text-tertiary cursor-grab" />
            <span className="text-secondary">{SECTION_ICONS[d.section]}</span>
            <span className="text-label font-medium text-primary flex-1 truncate">
              {d.label}
            </span>
            {/* Misconfiguration indicator in header — visible even when badge is suppressed */}
            {isMisconfigured && !showSetupBadge && (
              <span title={`${emptyFieldKeys.size} field${emptyFieldKeys.size !== 1 ? 's' : ''} need configuration`}>
                <AlertTriangle
                  className="size-3 shrink-0 text-loss opacity-60"
                  aria-hidden="true"
                />
              </span>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded hover:bg-loss/20 active:bg-loss/30 text-tertiary hover:text-loss transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Remove block"
              title="Remove block"
            >
              <X className="size-3" />
            </button>
          </div>

          {/* Config fields */}
          {d.fields.length > 0 && (
            <div className="px-3 py-2 space-y-2">
              {d.fields.map((field, fieldIdx) => {
                const isEmpty = emptyFieldKeys.has(field.key);
                const isWired = wireableConnections.has(field.key);
                // Approximate vertical center of this field relative to the node top.
                // Heights are derived from measured DOM values and are intentionally
                // approximate — exact pixel-perfect alignment is not achievable here
                // without runtime DOM measurement (charter §5 exception for builder canvas).
                // header ~34px + container padding 8px + fields before this one (each ~52px) + label 16px + input center 14px
                const handleTop = 34 + 8 + fieldIdx * 52 + 30;
                return (
                  <div key={field.key} className="relative">
                    {/* Per-field data-input handle for wireable fields */}
                    {field.wireable && (
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={field.key}
                        className="!w-2 !h-2 !bg-elevated !border-2 !rounded-full builder-handle"
                        style={{
                          '--node-color': 'var(--chart-category-2)',
                          top: `${handleTop}px`,
                        } as React.CSSProperties}
                      />
                    )}
                    <label className={`flex items-center gap-1 text-caption font-medium mb-1 uppercase tracking-wider ${isEmpty ? 'text-loss/80' : 'text-tertiary'}`}>
                      {field.wireable && (
                        <Link2
                          className={`size-3 shrink-0 ${isWired ? 'text-purple-500 opacity-100' : 'text-tertiary opacity-50'}`}
                          aria-label="This field can receive a value from a Variable or Calc node"
                        />
                      )}
                      {field.label}
                      {isEmpty && <span className="text-loss/80 normal-case tracking-normal font-normal">— required</span>}
                    </label>
                    {field.type === 'market_slot' ? (
                      <select
                        value={d.config[field.key] ?? ''}
                        onChange={(e) => onFieldChange(field.key, e.target.value)}
                        aria-label={field.label}
                        className={`w-full h-7 px-2 rounded text-label text-primary focus-visible:outline-none transition-colors ${
                          isEmpty
                            ? 'bg-loss-subtle border border-loss/40 focus-visible:border-loss/60'
                            : 'bg-[var(--block-color)]/10 border border-[var(--block-color)]/20 focus-visible:border-[var(--block-color)]/50'
                        }`}
                      >
                        <option value="">Select market slot...</option>
                        <option value="$MARKET_A">$MARKET_A</option>
                        <option value="$MARKET_B">$MARKET_B</option>
                        <option value="$MARKET_C">$MARKET_C</option>
                        <option value="$MARKET_D">$MARKET_D</option>
                        <option value="$MARKET_E">$MARKET_E</option>
                      </select>
                    ) : field.type === 'select' ? (
                      renderSelectField(field)
                    ) : isWired ? (
                      // Field is driven by a connected Variable/Calc node — show chip instead of input
                      <div className="flex items-center gap-2 px-2 py-1 rounded-sm bg-purple-500/10 border border-purple-500/30">
                        <Link2 className="size-3 shrink-0 text-purple-500" />
                        <span className="text-label text-purple-500 font-mono truncate">
                          {wireableConnections.get(field.key)}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={d.config[field.key] ?? ''}
                          onChange={(e) => onFieldChange(field.key, e.target.value)}
                          aria-label={field.label}
                          className={`w-full px-2 py-1 text-label bg-surface border rounded-sm placeholder:text-tertiary/50 focus-visible:outline-none transition-colors ${
                            isEmpty
                              ? 'border-loss/40 bg-loss-subtle focus-visible:border-loss/60'
                              : 'border-subtle focus-visible:border-accent/50'
                          } ${
                            (d.config[field.key] ?? '').startsWith('$')
                              ? 'text-purple-500 font-mono'
                              : 'text-primary'
                          }`}
                        />
                        {(d.config[field.key] ?? '').startsWith('$') && (
                          <span
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-caption text-purple-500/70 pointer-events-none"
                            title={`Variable: ${d.config[field.key]}`}
                          >
                            var
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* No fields message */}
          {d.fields.length === 0 && (
            <div className="px-3 py-2">
              <span className="text-caption text-tertiary italic">No configuration needed</span>
            </div>
          )}
        </div>
      </div>

      {/* Source handle (right) — actions and safety have no outgoing connections */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-elevated !border-2 !rounded-full builder-handle"
          style={{ '--node-color': d.color } as React.CSSProperties}
        />
      )}
    </>
  );
}

export const BlockNode = memo(BlockNodeInner);
