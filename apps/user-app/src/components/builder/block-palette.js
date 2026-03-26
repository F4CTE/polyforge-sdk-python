import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { Shield, Zap, Filter, Play, GitBranch, Calculator, GripVertical, X, ChevronRight, Settings2, Variable, Plus, } from 'lucide-react';
import { BLOCK_DEFS, SECTION_META, } from './block-definitions';
import { useBuilderStore } from '../../stores/builder-store';
const SECTIONS = [
    { key: 'variables', icon: _jsx(Variable, { className: "size-3" }) },
    { key: 'safety', icon: _jsx(Shield, { className: "size-3" }) },
    { key: 'triggers', icon: _jsx(Zap, { className: "size-3" }) },
    { key: 'conditions', icon: _jsx(Filter, { className: "size-3" }) },
    { key: 'logic', icon: _jsx(GitBranch, { className: "size-3" }) },
    { key: 'calc', icon: _jsx(Calculator, { className: "size-3" }) },
    { key: 'actions', icon: _jsx(Play, { className: "size-3" }) },
];
const VARIABLE_TAB_META = { label: 'Variables', color: 'var(--color-pf-purple-500)' };
export function BlockPalette({ open, onClose }) {
    const [activeSection, setActiveSection] = useState('safety');
    const name = useBuilderStore((s) => s.name);
    const description = useBuilderStore((s) => s.description);
    const execMode = useBuilderStore((s) => s.execMode);
    const tickMs = useBuilderStore((s) => s.tickMs);
    const visibility = useBuilderStore((s) => s.visibility);
    const tags = useBuilderStore((s) => s.tags);
    // Derive only node count per section to avoid re-renders on every node drag
    const nodeCountBySection = useBuilderStore((s) => {
        const counts = {};
        for (const n of s.nodes) {
            const section = n.type === 'variableNode' ? 'variables'
                : n.type === 'logicNode' ? 'logic'
                    : n.type === 'calcNode' ? 'calc'
                        : n.data?.section ?? 'unknown';
            counts[section] = (counts[section] ?? 0) + 1;
        }
        return counts;
    });
    const setName = useBuilderStore((s) => s.setName);
    const setDescription = useBuilderStore((s) => s.setDescription);
    const setExecMode = useBuilderStore((s) => s.setExecMode);
    const setTickMs = useBuilderStore((s) => s.setTickMs);
    const setVisibility = useBuilderStore((s) => s.setVisibility);
    const setTags = useBuilderStore((s) => s.setTags);
    const addNode = useBuilderStore((s) => s.addNode);
    const addVariable = useBuilderStore((s) => s.addVariable);
    const sectionCount = useCallback((section) => nodeCountBySection[section] ?? 0, [nodeCountBySection]);
    const onDragStart = useCallback((e, def, section) => {
        e.dataTransfer.setData('application/reactflow', JSON.stringify({ type: def.type, section }));
        e.dataTransfer.effectAllowed = 'move';
    }, []);
    const onBlockClick = useCallback((def) => {
        if (activeSection !== 'variables') {
            addNode(def, activeSection);
        }
    }, [addNode, activeSection]);
    return (_jsxs("div", { className: "w-80 shrink-0 bg-pf-elevated border-l border-pf-border shadow-pf-lg flex flex-col overflow-x-hidden overflow-y-auto h-full", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Settings2, { className: "size-4 text-pf-text-secondary" }), _jsx("span", { className: "text-sm font-medium text-pf-text", children: "Strategy Settings" })] }), _jsx("button", { onClick: onClose, "aria-label": "Close panel", className: "p-1 rounded hover:bg-pf-overlay text-pf-text-muted hover:text-pf-text transition-colors", children: _jsx(X, { className: "size-4" }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto overflow-x-hidden", children: [_jsxs("div", { className: "px-4 py-3 space-y-3 border-b border-pf-border-subtle", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider", children: "Strategy Name *" }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "My Strategy", className: "w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider", children: "Description" }), _jsx("textarea", { rows: 2, value: description, onChange: (e) => setDescription(e.target.value), placeholder: "What does this strategy do?", className: "w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors resize-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider", children: "Exec Mode" }), _jsxs("select", { value: execMode, onChange: (e) => setExecMode(e.target.value), className: "w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors", children: [_jsx("option", { value: "TICK", children: "Tick - evaluate on timer" }), _jsx("option", { value: "EVENT", children: "Event - evaluate on price change" }), _jsx("option", { value: "HYBRID", children: "Hybrid - both timer and price change" })] })] }), execMode !== 'EVENT' && (_jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider", children: "Tick Interval (ms)" }), _jsx("input", { type: "number", value: tickMs, onChange: (e) => setTickMs(Number(e.target.value)), placeholder: "1000", min: 200, className: "w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider", children: "Visibility" }), _jsxs("select", { value: visibility, onChange: (e) => setVisibility(e.target.value), className: "w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors", children: [_jsx("option", { value: "PRIVATE", children: "Private" }), _jsx("option", { value: "UNLISTED", children: "Unlisted" }), _jsx("option", { value: "PUBLIC", children: "Public" })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider", children: ["Tags ", _jsx("span", { className: "font-normal opacity-60", children: "(comma separated)" })] }), _jsx("input", { type: "text", value: tags, onChange: (e) => setTags(e.target.value), placeholder: "momentum, politics", className: "w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors" })] })] }), _jsxs("div", { className: "px-4 py-3", children: [_jsx("h3", { className: "text-xs font-medium text-pf-text-secondary uppercase tracking-wider mb-2", children: "Blocks" }), _jsx("div", { className: "flex gap-1 mb-3 overflow-x-auto scrollbar-none", children: SECTIONS.map(({ key, icon }) => {
                                    const meta = key === 'variables' ? VARIABLE_TAB_META : SECTION_META[key];
                                    const count = sectionCount(key);
                                    const isActive = activeSection === key;
                                    return (_jsxs("button", { onClick: () => setActiveSection(key), className: `flex items-center gap-1 px-2 py-1 rounded-pf-sm text-[11px] font-medium transition-all shrink-0 whitespace-nowrap ${isActive
                                            ? 'text-white shadow-pf-xs'
                                            : 'text-pf-text-muted hover:text-pf-text-secondary bg-transparent hover:bg-pf-overlay'}`, style: isActive ? { backgroundColor: meta.color + 'CC' } : undefined, children: [icon, meta.label, count > 0 && (_jsx("span", { className: "ml-0.5 px-1 py-px rounded-full text-[9px] font-semibold leading-none", style: {
                                                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : meta.color + '30',
                                                    color: isActive ? 'white' : meta.color,
                                                }, children: count }))] }, key));
                                }) }), activeSection === 'variables' ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("p", { className: "text-[10px] text-pf-text-muted leading-snug", children: ["Variables let you define reusable expressions. Reference them in block fields with ", _jsx("code", { className: "text-purple-400 font-mono", children: "$varName" }), "."] }), _jsxs("button", { onClick: addVariable, className: "flex items-center gap-2 w-full px-3 py-2 rounded-pf-sm text-xs font-medium text-white transition-colors hover:opacity-90", style: { backgroundColor: 'var(--color-pf-purple-500)' }, children: [_jsx(Plus, { className: "size-3.5" }), "Add Variable"] }), sectionCount('variables') > 0 && (_jsxs("p", { className: "text-[10px] text-pf-text-muted", children: [sectionCount('variables'), " variable", sectionCount('variables') !== 1 ? 's' : '', " on canvas"] }))] })) : (_jsx("div", { className: "space-y-1", children: BLOCK_DEFS[activeSection].map((def) => (_jsxs("div", { draggable: true, onDragStart: (e) => onDragStart(e, def, activeSection), onClick: () => onBlockClick(def), className: "group flex items-start gap-2 px-2.5 py-2 rounded-pf-sm cursor-pointer hover:bg-pf-overlay/60 transition-colors border border-transparent hover:border-pf-border-subtle", children: [_jsx(GripVertical, { className: "size-3 text-pf-text-muted/40 mt-0.5 shrink-0 cursor-grab group-hover:text-pf-text-muted" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-medium text-pf-text", children: def.label }), _jsx(ChevronRight, { className: "size-3 text-pf-text-muted/0 group-hover:text-pf-text-muted/60 transition-all" })] }), _jsx("p", { className: "text-[10px] text-pf-text-muted leading-snug mt-0.5", children: def.description })] })] }, def.type))) }))] })] })] }));
}
