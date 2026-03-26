import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { X, GripVertical, Shield, Zap, Filter, Play } from 'lucide-react';
import { useBuilderStore } from '../../../stores/builder-store';
const SECTION_ICONS = {
    safety: _jsx(Shield, { className: "size-3" }),
    triggers: _jsx(Zap, { className: "size-3" }),
    conditions: _jsx(Filter, { className: "size-3" }),
    actions: _jsx(Play, { className: "size-3" }),
};
function BlockNodeInner({ id, data }) {
    const d = data;
    const removeNode = useBuilderStore((s) => s.removeNode);
    const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
    const currentStrategyId = useBuilderStore((s) => s.strategyId);
    // Fetch user strategies for RUN_STRATEGY block's strategyId selector
    const [strategies, setStrategies] = useState([]);
    const isRunStrategy = d.type === 'RUN_STRATEGY';
    useEffect(() => {
        if (!isRunStrategy)
            return;
        fetch('/api/v1/strategies?limit=50', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((res) => {
            const list = (res.data ?? [])
                .filter((s) => s.id !== currentStrategyId) // exclude self
                .map((s) => ({ id: s.id, name: s.name }));
            setStrategies(list);
        })
            .catch(() => setStrategies([]));
    }, [isRunStrategy, currentStrategyId]);
    const onDelete = useCallback((e) => {
        e.stopPropagation();
        removeNode(id);
    }, [id, removeNode]);
    const onFieldChange = useCallback((key, value) => {
        updateNodeConfig(id, key, value);
    }, [id, updateNodeConfig]);
    /** Render a select field for strategy picker or mode picker */
    function renderSelectField(field) {
        // Strategy selector: fetch from API
        if (field.key === 'strategyId' && isRunStrategy) {
            return (_jsxs("select", { value: d.config[field.key] ?? '', onChange: (e) => onFieldChange(field.key, e.target.value), className: "w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors", children: [_jsx("option", { value: "", children: field.placeholder }), strategies.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] }));
        }
        // Generic select with static options
        return (_jsxs("select", { value: d.config[field.key] ?? '', onChange: (e) => onFieldChange(field.key, e.target.value), className: "w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors", children: [_jsx("option", { value: "", children: field.placeholder }), (field.options ?? []).map((opt) => (_jsx("option", { value: opt, children: opt.replace(/_/g, ' ') }, opt)))] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(Handle, { type: "target", position: Position.Left, className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: d.color } }), _jsxs("div", { className: "w-[260px] rounded-pf-md shadow-pf-md overflow-hidden", style: {
                    backgroundColor: 'var(--color-pf-elevated)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--color-pf-border)',
                    color: 'var(--color-pf-text)',
                }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2", style: { backgroundColor: d.color + '18', borderBottom: `2px solid ${d.color}` }, children: [_jsx(GripVertical, { className: "size-3 text-pf-text-muted cursor-grab" }), _jsx("span", { className: "text-pf-text-secondary", children: SECTION_ICONS[d.section] }), _jsx("span", { className: "text-xs font-medium text-pf-text flex-1 truncate", children: d.label }), _jsx("button", { onClick: onDelete, className: "p-0.5 rounded hover:bg-pf-danger/20 text-pf-text-muted hover:text-pf-danger transition-colors", "aria-label": "Remove block", title: "Remove block", children: _jsx(X, { className: "size-3" }) })] }), d.fields.length > 0 && (_jsx("div", { className: "px-3 py-2 space-y-2", children: d.fields.map((field) => (_jsxs("div", { children: [_jsx("label", { className: "block text-[10px] font-medium text-pf-text-muted mb-0.5 uppercase tracking-wider", children: field.label }), field.type === 'select' ? (renderSelectField(field)) : (_jsxs("div", { className: "relative", children: [_jsx("input", { type: field.type, placeholder: field.placeholder, value: d.config[field.key] ?? '', onChange: (e) => onFieldChange(field.key, e.target.value), className: `w-full px-2 py-1 text-xs bg-pf-surface border border-pf-border-subtle rounded-pf-sm placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors ${(d.config[field.key] ?? '').startsWith('$')
                                                ? 'text-purple-400 font-mono'
                                                : 'text-pf-text'}` }), (d.config[field.key] ?? '').startsWith('$') && (_jsx("span", { className: "absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-purple-400/70 pointer-events-none", title: `Variable: ${d.config[field.key]}`, children: "var" }))] }))] }, field.key))) })), d.fields.length === 0 && (_jsx("div", { className: "px-3 py-2", children: _jsx("span", { className: "text-[10px] text-pf-text-muted italic", children: "No configuration needed" }) }))] }), _jsx(Handle, { type: "source", position: Position.Right, className: "!w-2.5 !h-2.5 !bg-pf-elevated !border-2 !rounded-full", style: { borderColor: d.color } })] }));
}
export const BlockNode = memo(BlockNodeInner);
