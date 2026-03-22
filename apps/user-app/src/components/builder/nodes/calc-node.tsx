import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { X, GripVertical, Calculator, TrendingUp, Scale, Hash } from 'lucide-react';
import type { CalcNodeData } from '../../../stores/builder-store';
import { useBuilderStore } from '../../../stores/builder-store';

type CalcNode = Node<CalcNodeData, 'calcNode'>;

// ─── Type-specific config ───────────────────────────────────────────────────

const CALC_COLOR = '#10B981';

const CALC_ICONS: Record<string, React.ReactNode> = {
  MATH: <Calculator className="size-3" />,
  AGGREGATION: <TrendingUp className="size-3" />,
  COMPARISON: <Scale className="size-3" />,
  ABS_ROUND: <Hash className="size-3" />,
};

/** Math operation display symbols */
const MATH_SYMBOLS: Record<string, string> = {
  add: '+',
  subtract: '-',
  multiply: '\u00D7',
  divide: '\u00F7',
  modulo: '%',
  power: '^',
  min: 'MIN',
  max: 'MAX',
};

/** Aggregation function display labels */
function getAggLabel(fn: string, windowSize: string): string {
  const size = windowSize || '20';
  switch (fn) {
    case 'moving_average': return `MA(${size})`;
    case 'sum': return `SUM(${size})`;
    case 'min': return `MIN(${size})`;
    case 'max': return `MAX(${size})`;
    case 'count': return `COUNT(${size})`;
    default: return fn.toUpperCase();
  }
}

/** Comparison operator display */
const COMP_SYMBOLS: Record<string, string> = {
  '>': '>',
  '<': '<',
  '>=': '\u2265',
  '<=': '\u2264',
  '==': '=',
  '!=': '\u2260',
  between: 'BETWEEN',
};

/** AbsRound function display */
function getAbsRoundLabel(fn: string, decimals: string): string {
  switch (fn) {
    case 'abs': return 'ABS';
    case 'round': return decimals && decimals !== '0' ? `ROUND(${decimals})` : 'ROUND';
    case 'floor': return 'FLOOR';
    case 'ceil': return 'CEIL';
    case 'toFixed': return `toFixed(${decimals || '0'})`;
    default: return fn.toUpperCase();
  }
}

/** Number of input handles per calc type */
const INPUT_COUNTS: Record<string, number> = {
  MATH: 2,
  AGGREGATION: 1,
  COMPARISON: 2,
  ABS_ROUND: 1,
};

/** Math operation options for dropdown */
const MATH_OPTIONS = [
  { value: 'add', label: 'Add (+)' },
  { value: 'subtract', label: 'Subtract (-)' },
  { value: 'multiply', label: 'Multiply (\u00D7)' },
  { value: 'divide', label: 'Divide (\u00F7)' },
  { value: 'modulo', label: 'Modulo (%)' },
  { value: 'power', label: 'Power (^)' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

/** Aggregation function options */
const AGG_OPTIONS = [
  { value: 'moving_average', label: 'Moving Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
];

/** Comparison operator options */
const COMP_OPTIONS = [
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '>=', label: 'Greater or equal (\u2265)' },
  { value: '<=', label: 'Less or equal (\u2264)' },
  { value: '==', label: 'Equal (=)' },
  { value: '!=', label: 'Not equal (\u2260)' },
  { value: 'between', label: 'Between' },
];

/** AbsRound function options */
const ABS_ROUND_OPTIONS = [
  { value: 'abs', label: 'Absolute' },
  { value: 'round', label: 'Round' },
  { value: 'floor', label: 'Floor' },
  { value: 'ceil', label: 'Ceil' },
  { value: 'toFixed', label: 'toFixed' },
];

// ─── Component ──────────────────────────────────────────────────────────────

function CalcNodeInner({ id, data }: NodeProps<CalcNode>) {
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

  const icon = CALC_ICONS[d.type];
  const inputCount = INPUT_COUNTS[d.type] ?? 1;

  // Compute display symbol based on type and config
  const displaySymbol = useMemo(() => {
    switch (d.type) {
      case 'MATH':
        return MATH_SYMBOLS[d.config.operation || 'add'] ?? '+';
      case 'AGGREGATION':
        return getAggLabel(d.config.function || 'moving_average', d.config.windowSize || '20');
      case 'COMPARISON':
        return COMP_SYMBOLS[d.config.operator || '>'] ?? '>';
      case 'ABS_ROUND':
        return getAbsRoundLabel(d.config.function || 'abs', d.config.decimals || '0');
      default:
        return d.type;
    }
  }, [d.type, d.config]);

  // Get the appropriate options list for the dropdown
  const dropdownOptions = useMemo(() => {
    switch (d.type) {
      case 'MATH': return { key: 'operation', options: MATH_OPTIONS };
      case 'AGGREGATION': return { key: 'function', options: AGG_OPTIONS };
      case 'COMPARISON': return { key: 'operator', options: COMP_OPTIONS };
      case 'ABS_ROUND': return { key: 'function', options: ABS_ROUND_OPTIONS };
      default: return null;
    }
  }, [d.type]);

  const showBetweenFields = d.type === 'COMPARISON' && d.config.operator === 'between';
  const showDecimalsField = d.type === 'ABS_ROUND' && ['round', 'toFixed'].includes(d.config.function || '');
  const showWindowField = d.type === 'AGGREGATION';

  return (
    <>
      {/* Input handles (left side) */}
      {inputCount === 1 && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
          style={{ borderColor: CALC_COLOR }}
        />
      )}
      {inputCount === 2 && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="input-a"
            className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
            style={{ borderColor: CALC_COLOR, top: '35%' }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="input-b"
            className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
            style={{ borderColor: CALC_COLOR, top: '65%' }}
          />
        </>
      )}

      <div
        className="rounded-pf-md shadow-pf-md overflow-hidden"
        style={{
          width: '180px',
          backgroundColor: 'var(--color-pf-elevated)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: CALC_COLOR + '60',
          color: 'var(--color-pf-text)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5"
          style={{ backgroundColor: CALC_COLOR, color: 'white' }}
        >
          <GripVertical className="size-3 opacity-70 cursor-grab" />
          {icon}
          <span className="text-[11px] font-bold flex-1 truncate">{displaySymbol}</span>
          <span className="text-[9px] opacity-70">{d.label}</span>
          <button
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-white/20 transition-colors"
            title="Remove block"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Config: primary dropdown */}
        <div className="px-2.5 py-2 space-y-2">
          {dropdownOptions && (
            <div>
              <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                {d.type === 'MATH' ? 'Operation' : d.type === 'COMPARISON' ? 'Operator' : 'Function'}
              </label>
              <select
                value={d.config[dropdownOptions.key] ?? dropdownOptions.options[0]?.value ?? ''}
                onChange={(e) => onFieldChange(dropdownOptions.key, e.target.value)}
                className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-emerald-500/50 transition-colors"
              >
                {dropdownOptions.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Window size for aggregation */}
          {showWindowField && (
            <div>
              <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                Window (N ticks)
              </label>
              <input
                type="number"
                placeholder="20"
                value={d.config.windowSize ?? ''}
                onChange={(e) => onFieldChange('windowSize', e.target.value)}
                className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          )}

          {/* Between min/max fields for comparison */}
          {showBetweenFields && (
            <>
              <div>
                <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                  Min
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={d.config.min ?? ''}
                  onChange={(e) => onFieldChange('min', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                  Max
                </label>
                <input
                  type="number"
                  placeholder="100"
                  value={d.config.max ?? ''}
                  onChange={(e) => onFieldChange('max', e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </>
          )}

          {/* Decimals field for abs/round */}
          {showDecimalsField && (
            <div>
              <label className="block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider">
                Decimals
              </label>
              <input
                type="number"
                placeholder="0"
                value={d.config.decimals ?? ''}
                onChange={(e) => onFieldChange('decimals', e.target.value)}
                className="w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          )}

          {/* Input handle labels */}
          {inputCount === 2 && (
            <div className="flex items-center gap-2 text-[10px] text-pf-text-muted">
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                A
              </span>
              <span>/</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                B
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Output handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full"
        style={{ borderColor: CALC_COLOR }}
      />
    </>
  );
}

export const CalcNode = memo(CalcNodeInner);
