import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, } from '@xyflow/react';
import { SECTION_COLUMNS, findBlockDef, } from '../components/builder/block-definitions';
const SECTION_COLORS = {
    safety: '#EF4444',
    triggers: '#F59E0B',
    conditions: '#3B82F6',
    actions: '#22C55E',
    logic: '#3B82F6',
    calc: '#10B981',
};
const LOGIC_COLORS = {
    IF_THEN_ELSE: '#F59E0B',
    AND_GATE: '#3B82F6',
    OR_GATE: '#3B82F6',
    NOT_GATE: '#3B82F6',
    DELAY: '#6B7280',
};
const VARIABLE_COLUMN_X = 0;
function initialState() {
    return {
        nodes: [],
        edges: [],
        strategyId: null,
        name: '',
        description: '',
        execMode: 'TICK',
        tickMs: 1000,
        visibility: 'PRIVATE',
        tags: '',
        saving: false,
        loading: false,
        dirty: false,
    };
}
export const useBuilderStore = create((set, get) => ({
    ...initialState(),
    // ─── React Flow callbacks ────────────────────────────────────────────────
    setNodes: (nodes) => set({ nodes, dirty: true }),
    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
            dirty: true,
        });
    },
    setEdges: (edges) => set({ edges, dirty: true }),
    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
            dirty: true,
        });
    },
    onConnect: (connection) => {
        set({
            edges: addEdge({ ...connection, type: 'smoothstep', animated: true }, get().edges),
            dirty: true,
        });
    },
    // ─── Builder actions ─────────────────────────────────────────────────────
    addNode: (blockDef, section, position) => {
        const { nodes } = get();
        if (section === 'logic') {
            // Logic blocks use logicNode type
            const existingLogic = nodes.filter((n) => n.type === 'logicNode');
            const x = position?.x ?? SECTION_COLUMNS.logic;
            const y = position?.y ?? 100 + existingLogic.length * 160;
            const newNode = {
                id: crypto.randomUUID(),
                type: 'logicNode',
                position: { x, y },
                data: {
                    type: blockDef.type,
                    label: blockDef.label,
                    section: 'logic',
                    color: LOGIC_COLORS[blockDef.type] ?? '#3B82F6',
                    config: Object.fromEntries(blockDef.fields.map((f) => [f.key, ''])),
                    fields: blockDef.fields,
                    outputs: blockDef.outputs,
                },
            };
            set({ nodes: [...nodes, newNode], dirty: true });
            return;
        }
        if (section === 'calc') {
            // Calculation blocks use calcNode type
            const existingCalc = nodes.filter((n) => n.type === 'calcNode');
            const x = position?.x ?? SECTION_COLUMNS.calc;
            const y = position?.y ?? 100 + existingCalc.length * 160;
            const newNode = {
                id: crypto.randomUUID(),
                type: 'calcNode',
                position: { x, y },
                data: {
                    type: blockDef.type,
                    label: blockDef.label,
                    section: 'calc',
                    color: '#10B981',
                    config: Object.fromEntries(blockDef.fields.map((f) => [f.key, ''])),
                    fields: blockDef.fields,
                },
            };
            set({ nodes: [...nodes, newNode], dirty: true });
            return;
        }
        const existingInSection = nodes.filter((n) => n.data.section === section);
        const x = position?.x ?? SECTION_COLUMNS[section];
        const y = position?.y ?? 100 + existingInSection.length * 200;
        const newNode = {
            id: crypto.randomUUID(),
            type: 'blockNode',
            position: { x, y },
            data: {
                type: blockDef.type,
                label: blockDef.label,
                section,
                color: SECTION_COLORS[section],
                config: Object.fromEntries(blockDef.fields.map((f) => [f.key, ''])),
                fields: blockDef.fields,
            },
        };
        set({ nodes: [...nodes, newNode], dirty: true });
    },
    removeNode: (nodeId) => {
        set({
            nodes: get().nodes.filter((n) => n.id !== nodeId),
            edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            dirty: true,
        });
    },
    updateNodeConfig: (nodeId, key, value) => {
        set({
            nodes: get().nodes.map((n) => n.id === nodeId
                ? {
                    ...n,
                    data: {
                        ...n.data,
                        config: { ...n.data.config, [key]: value },
                    },
                }
                : n),
            dirty: true,
        });
    },
    // ─── Variable actions ──────────────────────────────────────────────────
    addVariable: () => {
        const { nodes } = get();
        const variableNodes = nodes.filter((n) => n.type === 'variableNode');
        // Generate default name: var1, var2, ...
        let idx = variableNodes.length + 1;
        const existingNames = new Set(variableNodes.map((n) => n.data.variableName));
        while (existingNames.has(`var${idx}`))
            idx++;
        const newNode = {
            id: crypto.randomUUID(),
            type: 'variableNode',
            position: {
                x: VARIABLE_COLUMN_X,
                y: 100 + variableNodes.length * 160,
            },
            data: {
                variableName: `var${idx}`,
                expression: '',
            },
        };
        set({ nodes: [...nodes, newNode], dirty: true });
    },
    updateVariable: (nodeId, field, value) => {
        set({
            nodes: get().nodes.map((n) => n.id === nodeId
                ? {
                    ...n,
                    data: { ...n.data, [field]: value },
                }
                : n),
            dirty: true,
        });
    },
    removeVariable: (nodeId) => {
        set({
            nodes: get().nodes.filter((n) => n.id !== nodeId),
            edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            dirty: true,
        });
    },
    // ─── Metadata setters ───────────────────────────────────────────────────
    setName: (name) => set({ name, dirty: true }),
    setDescription: (description) => set({ description, dirty: true }),
    setExecMode: (execMode) => set({ execMode, dirty: true }),
    setTickMs: (tickMs) => set({ tickMs, dirty: true }),
    setVisibility: (visibility) => set({ visibility, dirty: true }),
    setTags: (tags) => set({ tags, dirty: true }),
    // ─── Load strategy ──────────────────────────────────────────────────────
    loadStrategy: async (id) => {
        set({ loading: true });
        try {
            const res = await fetch(`/api/v1/strategies/${id}`, {
                credentials: 'include',
            });
            if (!res.ok)
                throw new Error('Failed to load');
            const s = await res.json();
            const nodes = [];
            const canvasLayout = s.canvas;
            const storedPositions = (canvasLayout?.positions || {});
            const sectionOrder = [
                'safety',
                'triggers',
                'conditions',
                'actions',
            ];
            for (const section of sectionOrder) {
                const items = (s[section] ?? []);
                items.forEach((b, i) => {
                    const blockId = b.id || crypto.randomUUID();
                    const storedPos = storedPositions[blockId];
                    const def = findBlockDef(b.type);
                    nodes.push({
                        id: blockId,
                        type: 'blockNode',
                        position: {
                            x: storedPos?.x ?? SECTION_COLUMNS[section],
                            y: storedPos?.y ?? 100 + i * 200,
                        },
                        data: {
                            type: b.type,
                            label: def?.label ?? b.type,
                            section,
                            color: SECTION_COLORS[section],
                            config: Object.fromEntries(Object.entries(b.config).map(([k, v]) => [k, String(v)])),
                            fields: def?.fields ?? [],
                        },
                    });
                });
            }
            // Restore logic block nodes
            const storedLogicBlocks = (s.logicBlocks ?? canvasLayout?.logicBlocks ?? []);
            storedLogicBlocks.forEach((lb, i) => {
                const lbId = lb.id || crypto.randomUUID();
                const storedPos = storedPositions[lbId];
                const def = findBlockDef(lb.type);
                nodes.push({
                    id: lbId,
                    type: 'logicNode',
                    position: {
                        x: storedPos?.x ?? SECTION_COLUMNS.logic,
                        y: storedPos?.y ?? 100 + i * 160,
                    },
                    data: {
                        type: lb.type,
                        label: def?.label ?? lb.type,
                        section: 'logic',
                        color: LOGIC_COLORS[lb.type] ?? '#3B82F6',
                        config: Object.fromEntries(Object.entries(lb.config).map(([k, v]) => [k, String(v)])),
                        fields: def?.fields ?? [],
                        outputs: lb.outputs ?? def?.outputs,
                    },
                });
            });
            // Restore calc block nodes
            const storedCalcBlocks = (s.calcBlocks ?? canvasLayout?.calcBlocks ?? []);
            storedCalcBlocks.forEach((cb, i) => {
                const cbId = cb.id || crypto.randomUUID();
                const storedPos = storedPositions[cbId];
                const def = findBlockDef(cb.type);
                nodes.push({
                    id: cbId,
                    type: 'calcNode',
                    position: {
                        x: storedPos?.x ?? SECTION_COLUMNS.calc,
                        y: storedPos?.y ?? 100 + i * 160,
                    },
                    data: {
                        type: cb.type,
                        label: def?.label ?? cb.type,
                        section: 'calc',
                        color: '#10B981',
                        config: Object.fromEntries(Object.entries(cb.config).map(([k, v]) => [k, String(v)])),
                        fields: def?.fields ?? [],
                    },
                });
            });
            // Restore variable nodes from strategy.variables or canvas.variables
            const storedVariables = (s.variables ?? canvasLayout?.variables ?? []);
            storedVariables.forEach((v, i) => {
                const varId = v.id || crypto.randomUUID();
                const storedPos = storedPositions[varId];
                nodes.push({
                    id: varId,
                    type: 'variableNode',
                    position: {
                        x: storedPos?.x ?? VARIABLE_COLUMN_X,
                        y: storedPos?.y ?? 100 + i * 160,
                    },
                    data: {
                        variableName: v.name,
                        expression: v.expression,
                    },
                });
            });
            // Restore edges from canvas.connections if present
            const storedConnections = (canvasLayout?.connections ?? []);
            const edges = storedConnections.map((c) => ({
                id: c.id || crypto.randomUUID(),
                source: c.source,
                sourceHandle: c.sourceHandle ?? null,
                target: c.target,
                targetHandle: c.targetHandle ?? null,
                type: 'smoothstep',
                animated: true,
            }));
            set({
                strategyId: id,
                name: s.name ?? '',
                description: s.description ?? '',
                execMode: s.execMode ?? 'TICK',
                tickMs: s.tickMs ?? 1000,
                visibility: s.visibility ?? 'PRIVATE',
                tags: (s.tags ?? []).join(', '),
                nodes,
                edges,
                loading: false,
                dirty: false,
            });
        }
        catch {
            set({ loading: false });
            throw new Error('Failed to load strategy');
        }
    },
    // ─── Save strategy ──────────────────────────────────────────────────────
    save: async () => {
        const state = get();
        if (!state.name.trim())
            throw new Error('Name is required');
        set({ saving: true });
        const blockNodes = state.nodes.filter((n) => n.type === 'blockNode');
        const logicNodes = state.nodes.filter((n) => n.type === 'logicNode');
        const calcNodes = state.nodes.filter((n) => n.type === 'calcNode');
        const variableNodes = state.nodes.filter((n) => n.type === 'variableNode');
        const toBlock = (n) => ({
            id: n.id,
            type: n.data.type,
            config: n.data.config,
        });
        const toLogicBlock = (n) => ({
            id: n.id,
            type: n.data.type,
            config: n.data.config,
            outputs: n.data.outputs,
        });
        const toCalcBlock = (n) => ({
            id: n.id,
            type: n.data.type,
            config: n.data.config,
        });
        const positions = {};
        for (const n of state.nodes) {
            positions[n.id] = { x: n.position.x, y: n.position.y };
        }
        const connections = state.edges.map((e) => ({
            id: e.id,
            source: e.source,
            sourceHandle: e.sourceHandle,
            target: e.target,
            targetHandle: e.targetHandle,
        }));
        // Extract variables from variable nodes
        const variables = variableNodes.map((n) => ({
            id: n.id,
            name: n.data.variableName,
            expression: n.data.expression,
        }));
        const dto = {
            name: state.name.trim(),
            description: state.description.trim(),
            visibility: state.visibility,
            execMode: state.execMode,
            tickMs: Number(state.tickMs),
            safety: blockNodes
                .filter((n) => n.data.section === 'safety')
                .map(toBlock),
            triggers: blockNodes
                .filter((n) => n.data.section === 'triggers')
                .map(toBlock),
            conditions: blockNodes
                .filter((n) => n.data.section === 'conditions')
                .map(toBlock),
            actions: blockNodes
                .filter((n) => n.data.section === 'actions')
                .map(toBlock),
            logicBlocks: logicNodes.map(toLogicBlock),
            calcBlocks: calcNodes.map(toCalcBlock),
            tags: state.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            variables,
            canvas: { positions, connections },
        };
        try {
            const url = state.strategyId
                ? `/api/v1/strategies/${state.strategyId}`
                : '/api/v1/strategies';
            const method = state.strategyId ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dto),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? 'Save failed');
            }
            const saved = await res.json();
            set({ strategyId: saved.id, saving: false, dirty: false });
            return saved;
        }
        catch (err) {
            set({ saving: false });
            throw err;
        }
    },
    // ─── Reset ──────────────────────────────────────────────────────────────
    reset: () => set(initialState()),
}));
