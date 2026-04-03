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
    ? 'color-mix(in srgb, var(--color-pf-cyan-500) 90%, transparent)'
    : isExecuting
    ? d.color + '60'
    : isInactive
    ? 'color-mix(in srgb, var(--color-pf-warning) 27%, transparent)'
    : showSetupBadge
    ? 'color-mix(in srgb, var(--color-pf-danger) 33%, transparent)'
    : 'var(--color-pf-border)';

  // Pulse animation speed varies by section to convey different "rhythms":
  // triggers scan rapidly, safety beats slowly like a heartbeat
  const PULSE_DURATION: Record<string, string> = {
    triggers:   '1.4s',
    actions:    '1.8s',
    conditions: '2.4s',
    logic:      '2.0s',
    calc:       '2.0s',
    safety:     '3.6s',
  };
  const pulseKeyframe = d.section === 'safety' ? 'safetyPulse' : 'blockPulse';
  const pulseDuration = PULSE_DURATION[d.section] ?? '2.0s';

  const cardAnimation = hasFired
    ? 'blockFired 0.9s ease-out forwards'
    : isExecuting && !isInactive
    ? `${pulseKeyframe} ${pulseDuration} ease-in-out infinite`
    : undefined;

  const boxShadow = !isExecuting && !hasFired && showSetupBadge
    ? '0 0 0 1px color-mix(in srgb, var(--color-pf-danger) 18%, transparent), 0 0 14px color-mix(in srgb, var(--color-pf-danger) 12%, transparent)'
    : undefined;

  /** Render a select field for strategy picker or mode picker */
  function renderSelectField(field: { key: string; label: string; placeholder: string; options?: string[] }) {
    const isEmpty = emptyFieldKeys.has(field.key);
    const selectClass = `w-full px-2 py-1 text-xs bg-pf-surface border rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors ${
      isEmpty ? 'border-pf-danger/40 bg-pf-danger/5' : 'border-pf-border-subtle'
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
          className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full"
          style={{ borderColor: d.color }}
        />
      )}

      <div className="relative">
        {/* "Global" badge — safety/conditions when unwired: active globally */}
        {isGlobal && (
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-pf-full text-pf-micro font-semibold whitespace-nowrap z-10 pointer-events-none"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-pf-cyan-500) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-pf-cyan-500) 33%, transparent)', color: 'var(--color-pf-cyan-500)' }}
            title={isSafety ? 'Safety block — always enforced globally on every tick' : 'Condition block — no connections, acts as a global gate for all execution paths. Wire it to scope it to a specific path.'}
          >
            <Globe className="size-2.5" />
            Global
          </div>
        )}

        {/* "Not wired" badge — triggers/actions with no edges: inactive */}
        {isInactive && (
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-pf-full text-pf-micro font-semibold whitespace-nowrap z-10 pointer-events-none"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-pf-gold-500) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-pf-gold-500) 33%, transparent)', color: 'var(--color-pf-gold-500)' }}
            title={isTrigger ? 'Trigger has no outgoing connection — wire it to a condition or action to activate it' : 'Action has no incoming connection — wire a trigger or condition to it to activate it'}
          >
            <Unlink className="size-2.5" />
            Not wired
          </div>
        )}

        {/* "Setup needed" badge — active block with one or more empty required fields */}
        {showSetupBadge && (
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-pf-full text-pf-micro font-semibold whitespace-nowrap z-10 pointer-events-none"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-pf-danger) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-pf-danger) 33%, transparent)', color: 'var(--color-pf-danger)' }}
            title={`${emptyFieldKeys.size} required field${emptyFieldKeys.size !== 1 ? 's' : ''} not filled in`}
          >
            <AlertTriangle className="size-2.5" />
            Setup needed
          </div>
        )}

        <div
          className={`w-[260px] rounded-pf-md shadow-pf-md overflow-hidden ${isInactive ? 'opacity-45' : ''}`}
          style={{
            backgroundColor: 'var(--color-pf-elevated)',
            borderWidth: (isExecuting || hasFired) ? '1.5px' : '1px',
            borderStyle: isInactive ? 'dashed' : 'solid',
            borderColor,
            boxShadow,
            animation: cardAnimation,
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
            {/* Misconfiguration indicator in header — visible even when badge is suppressed */}
            {isMisconfigured && !showSetupBadge && (
              <span title={`${emptyFieldKeys.size} field${emptyFieldKeys.size !== 1 ? 's' : ''} need configuration`}>
                <AlertTriangle
                  className="size-3 shrink-0"
                  style={{ color: 'var(--color-pf-danger)', opacity: 0.6 }}
                  aria-hidden="true"
                />
              </span>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 rounded hover:bg-pf-danger/20 active:bg-pf-danger/30 text-pf-text-muted hover:text-pf-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pf-cyan-500/50"
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
                // Approximate vertical center of this field relative to the node top:
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
                        className="!w-2 !h-2 !bg-pf-elevated !border-2 !rounded-pf-full"
                        style={{
                          top: `${handleTop}px`,
                          borderColor: 'var(--color-pf-purple-500)',
                        }}
                      />
                    )}
                    <label className={`flex items-center gap-1 text-pf-caption font-medium mb-0.5 uppercase tracking-wider ${isEmpty ? 'text-pf-danger/80' : 'text-pf-text-muted'}`}>
                      {field.wireable && (
                        <Link2
                          className="size-2.5 shrink-0"
                          style={{ color: isWired ? 'var(--color-pf-purple-500)' : 'var(--color-pf-text-muted)', opacity: isWired ? 1 : 0.5 }}
                          aria-label="This field can receive a value from a Variable or Calc node"
                        />
                      )}
                      {field.label}
                      {isEmpty && <span className="text-pf-danger/80 normal-case tracking-normal font-normal">— required</span>}
                    </label>
                    {field.type === 'market_slot' ? (
                      <select
                        value={d.config[field.key] ?? ''}
                        onChange={(e) => onFieldChange(field.key, e.target.value)}
                        aria-label={field.label}
                        className={`w-full h-7 px-2 rounded text-xs text-pf-text focus:outline-none transition-colors ${
                          isEmpty
                            ? 'bg-pf-danger/8 border border-pf-danger/40 focus:border-pf-danger/60'
                            : 'bg-[var(--block-color)]/10 border border-[var(--block-color)]/20 focus:border-[var(--block-color)]/50'
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
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-pf-sm bg-pf-purple-500/10 border border-pf-purple-500/30">
                        <Link2 className="size-3 shrink-0 text-pf-purple-500" />
                        <span className="text-xs text-pf-purple-500 font-mono truncate">
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
                          className={`w-full px-2 py-1 text-xs bg-pf-surface border rounded-pf-sm placeholder:text-pf-text-muted/50 focus:outline-none transition-colors ${
                            isEmpty
                              ? 'border-pf-danger/40 bg-pf-danger/5 focus:border-pf-danger/60'
                              : 'border-pf-border-subtle focus:border-pf-cyan-500/50'
                          } ${
                            (d.config[field.key] ?? '').startsWith('$')
                              ? 'text-pf-purple-500 font-mono'
                              : 'text-pf-text'
                          }`}
                        />
                        {(d.config[field.key] ?? '').startsWith('$') && (
                          <span
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-pf-micro text-pf-purple-500/70 pointer-events-none"
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
              <span className="text-pf-caption text-pf-text-muted italic">No configuration needed</span>
            </div>
          )}
        </div>
      </div>

      {/* Source handle (right) — actions and safety have no outgoing connections */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-pf-full"
          style={{ borderColor: d.color }}
        />
      )}
    </>
  );
}

export const BlockNode = memo(BlockNodeInner);
