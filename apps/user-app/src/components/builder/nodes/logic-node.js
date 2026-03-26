import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { X, GripVertical, GitBranch, Combine, Ban, Timer } from 'lucide-react';
import { useBuilderStore } from '../../../stores/builder-store';
// ─── Type-specific config ───────────────────────────────────────────────────
const LOGIC_ICONS = {
    IF_THEN_ELSE: _jsx(GitBranch, { className: "size-3" }),
    AND_GATE: _jsx(Combine, { className: "size-3" }),
    OR_GATE: _jsx(Combine, { className: "size-3" }),
    NOT_GATE: _jsx(Ban, { className: "size-3" }),
    DELAY: _jsx(Timer, { className: "size-3" }),
};
const LOGIC_SYMBOLS = {
    IF_THEN_ELSE: 'IF',
    AND_GATE: '&',
    OR_GATE: '||',
    NOT_GATE: '!',
    DELAY: 'Wait',
};
const LOGIC_COLORS = {
    IF_THEN_ELSE: 'var(--color-pf-warning)', // amber
    AND_GATE: 'var(--color-pf-info)', // blue
    OR_GATE: 'var(--color-pf-info)', // blue
    NOT_GATE: 'var(--color-pf-info)', // blue
    DELAY: '#6B7280', // gray
};
/** Number of input handles per logic type */
const INPUT_COUNTS = {
    IF_THEN_ELSE: 1,
    AND_GATE: 2,
    OR_GATE: 2,
    NOT_GATE: 1,
    DELAY: 1,
};
// ─── Component ──────────────────────────────────────────────────────────────
function LogicNodeInner({ id, data }) {
    const d = data;
    const removeNode = useBuilderStore((s) => s.removeNode);
    const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
    const onDelete = useCallback((e) => {
        e.stopPropagation();
        removeNode(id);
    }, [id, removeNode]);
    const onFieldChange = useCallback((key, value) => {
        updateNodeConfig(id, key, value);
    }, [id, updateNodeConfig]);
    const color = LOGIC_COLORS[d.type] ?? 'var(--color-pf-info)';
    const symbol = LOGIC_SYMBOLS[d.type] ?? d.type;
    const icon = LOGIC_ICONS[d.type];
    const inputCount = INPUT_COUNTS[d.type] ?? 1;
    const hasMultiOutput = d.outputs && d.outputs.length > 1;
    const isCompact = d.type === 'NOT_GATE' || (d.type === 'AND_GATE') || (d.type === 'OR_GATE');
    const width = isCompact ? 160 : 220;
    return (_jsxs(_Fragment, { children: [inputCount === 1 && (_jsx(Handle, { type: "target", position: Position.Left, id: "input", className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: color } })), inputCount === 2 && (_jsxs(_Fragment, { children: [_jsx(Handle, { type: "target", position: Position.Left, id: "input-a", className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: color, top: '35%' } }), _jsx(Handle, { type: "target", position: Position.Left, id: "input-b", className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: color, top: '65%' } })] })), _jsxs("div", { className: "rounded-pf-md shadow-pf-md overflow-hidden", style: {
                    width: `${width}px`,
                    backgroundColor: 'var(--color-pf-elevated)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: color + '60',
                    color: 'var(--color-pf-text)',
                }, children: [_jsxs("div", { className: "flex items-center gap-1.5 px-2.5 py-1.5", style: { backgroundColor: color, color: 'white' }, children: [_jsx(GripVertical, { className: "size-3 opacity-70 cursor-grab" }), icon, _jsx("span", { className: "text-[11px] font-bold flex-1 truncate", children: symbol }), _jsx("span", { className: "text-[9px] opacity-70", children: d.label }), _jsx("button", { onClick: onDelete, className: "p-0.5 rounded hover:bg-white/20 transition-colors", "aria-label": "Remove block", title: "Remove block", children: _jsx(X, { className: "size-3" }) })] }), d.fields.length > 0 && (_jsx("div", { className: "px-2.5 py-2 space-y-2", children: d.fields.map((field) => (_jsxs("div", { children: [_jsx("label", { className: "block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider", children: field.label }), _jsx("input", { type: field.type, placeholder: field.placeholder, value: d.config[field.key] ?? '', onChange: (e) => onFieldChange(field.key, e.target.value), className: `w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors ${(d.config[field.key] ?? '').startsWith('$')
                                        ? 'text-purple-400 font-mono'
                                        : 'text-pf-text'}` })] }, field.key))) })), d.fields.length === 0 && isCompact && (_jsx("div", { className: "px-2.5 py-1.5", children: _jsxs("span", { className: "text-[10px] text-pf-text-muted italic", children: [d.type === 'AND_GATE' && 'True if all inputs are true', d.type === 'OR_GATE' && 'True if any input is true', d.type === 'NOT_GATE' && 'Inverts input'] }) })), d.type === 'IF_THEN_ELSE' && d.config.condition && (_jsx("div", { className: "px-2.5 pb-2", children: _jsxs("div", { className: "flex items-center gap-2 text-[10px]", children: [_jsx("span", { className: "px-1.5 py-0.5 rounded-full bg-pf-success/20 text-pf-success font-medium", children: "TRUE" }), _jsx("span", { className: "text-pf-text-muted", children: "/" }), _jsx("span", { className: "px-1.5 py-0.5 rounded-full bg-pf-danger/20 text-pf-danger font-medium", children: "FALSE" })] }) })), d.type === 'DELAY' && d.config.seconds && (_jsx("div", { className: "px-2.5 pb-2", children: _jsxs("span", { className: "text-[10px] text-pf-text-muted", children: ["Wait ", d.config.seconds, "s"] }) }))] }), hasMultiOutput ? (_jsxs(_Fragment, { children: [_jsx(Handle, { type: "source", position: Position.Right, id: "true-out", className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: 'var(--color-pf-success)', top: '35%' } }), _jsx(Handle, { type: "source", position: Position.Right, id: "false-out", className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: 'var(--color-pf-danger)', top: '65%' } })] })) : (_jsx(Handle, { type: "source", position: Position.Right, id: "output", className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: color } }))] }));
}
export const LogicNode = memo(LogicNodeInner);
