import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import {
  type BlockDef,
  type BlockSection,
  type BlockField,
  SECTION_COLUMNS,
  findBlockDef,
} from '../components/builder/block-definitions';
import type { VariableNodeData } from '../components/builder/nodes/variable-node';

// ─── Node data shape ─────────────────────────────────────────────────────────

export interface BlockNodeData {
  type: string;
  label: string;
  section: BlockSection;
  color: string;
  config: Record<string, string>;
  fields: BlockField[];
  [key: string]: unknown;
}

export interface LogicNodeData {
  type: string;
  label: string;
  section: 'logic';
  color: string;
  config: Record<string, string>;
  fields: BlockField[];
  outputs?: string[];
  [key: string]: unknown;
}

export interface CalcNodeData {
  type: string;
  label: string;
  section: 'calc';
  color: string;
  config: Record<string, string>;
  fields: BlockField[];
  [key: string]: unknown;
}

export type { VariableNodeData };

// ─── Store types ─────────────────────────────────────────────────────────────

interface BuilderState {
  // Canvas state
  nodes: Node<BlockNodeData>[];
  edges: Edge[];

  // Strategy metadata
  strategyId: string | null;
  name: string;
  description: string;
  execMode: string;
  tickMs: number;
  visibility: string;
  tags: string;

  // UI state
  saving: boolean;
  loading: boolean;
  dirty: boolean;

  // Node/edge actions (React Flow callbacks)
  setNodes: (nodes: Node<BlockNodeData>[]) => void;
  onNodesChange: OnNodesChange<Node<BlockNodeData>>;
  setEdges: (edges: Edge[]) => void;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Builder actions
  addNode: (blockDef: BlockDef, section: BlockSection, position?: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;

  // Variable actions
  addVariable: () => void;
  updateVariable: (nodeId: string, field: 'variableName' | 'expression', value: string) => void;
  removeVariable: (nodeId: string) => void;

  // Metadata actions
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setExecMode: (execMode: string) => void;
  setTickMs: (tickMs: number) => void;
  setVisibility: (visibility: string) => void;
  setTags: (tags: string) => void;

  // Persistence
  save: () => Promise<any>;
  loadStrategy: (id: string) => Promise<void>;
  reset: () => void;
}

const SECTION_COLORS: Record<BlockSection, string> = {
  safety: '#EF4444',
  triggers: '#F59E0B',
  conditions: '#3B82F6',
  actions: '#22C55E',
  logic: '#3B82F6',
  calc: '#10B981',
};

const LOGIC_COLORS: Record<string, string> = {
  IF_THEN_ELSE: '#F59E0B',
  AND_GATE: '#3B82F6',
  OR_GATE: '#3B82F6',
  NOT_GATE: '#3B82F6',
  DELAY: '#6B7280',
};

const VARIABLE_COLUMN_X = 0;

function initialState() {
  return {
    nodes: [] as Node<BlockNodeData>[],
    edges: [] as Edge[],
    strategyId: null as string | null,
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

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...initialState(),

  // ─── React Flow callbacks ────────────────────────────────────────────────

  setNodes: (nodes) => set({ nodes, dirty: true }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<BlockNodeData>[],
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
      edges: addEdge(
        { ...connection, type: 'smoothstep', animated: true },
        get().edges,
      ),
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

      const newNode: Node<LogicNodeData> = {
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

      const newNode: Node<CalcNodeData> = {
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

    const existingInSection = nodes.filter(
      (n) => (n.data as BlockNodeData).section === section,
    );
    const x = position?.x ?? SECTION_COLUMNS[section];
    const y = position?.y ?? 100 + existingInSection.length * 200;

    const newNode: Node<BlockNodeData> = {
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
      edges: get().edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      ),
      dirty: true,
    });
  },

  updateNodeConfig: (nodeId, key, value) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                config: { ...(n.data as BlockNodeData).config, [key]: value },
              },
            }
          : n,
      ) as Node<BlockNodeData>[],
      dirty: true,
    });
  },

  // ─── Variable actions ──────────────────────────────────────────────────

  addVariable: () => {
    const { nodes } = get();
    const variableNodes = nodes.filter((n) => n.type === 'variableNode');

    // Generate default name: var1, var2, ...
    let idx = variableNodes.length + 1;
    const existingNames = new Set(
      variableNodes.map((n) => (n.data as unknown as VariableNodeData).variableName),
    );
    while (existingNames.has(`var${idx}`)) idx++;

    const newNode: Node = {
      id: crypto.randomUUID(),
      type: 'variableNode',
      position: {
        x: VARIABLE_COLUMN_X,
        y: 100 + variableNodes.length * 160,
      },
      data: {
        variableName: `var${idx}`,
        expression: '',
      } satisfies VariableNodeData,
    };

    set({ nodes: [...nodes, newNode as Node<BlockNodeData>], dirty: true });
  },

  updateVariable: (nodeId, field, value) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: { ...n.data, [field]: value },
            }
          : n,
      ),
      dirty: true,
    });
  },

  removeVariable: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      ),
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
      if (!res.ok) throw new Error('Failed to load');
      const s = await res.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const nodes: Node<BlockNodeData>[] = [];
      const canvasLayout = s.canvas as Record<string, unknown> | undefined;
      const storedPositions = (canvasLayout?.positions || {}) as Record<string, { x: number; y: number }>;
      const sectionOrder: BlockSection[] = [
        'safety',
        'triggers',
        'conditions',
        'actions',
      ];

      for (const section of sectionOrder) {
        const items = (s[section] ?? []) as {
          id?: string;
          type: string;
          config: Record<string, any>;
        }[];
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
              config: Object.fromEntries(
                Object.entries(b.config).map(([k, v]) => [k, String(v)]),
              ),
              fields: def?.fields ?? [],
            },
          });
        });
      }

      // Restore logic block nodes
      const storedLogicBlocks = (s.logicBlocks ?? canvasLayout?.logicBlocks ?? []) as {
        id?: string;
        type: string;
        config: Record<string, any>;
        outputs?: string[];
      }[];
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
            config: Object.fromEntries(
              Object.entries(lb.config).map(([k, v]) => [k, String(v)]),
            ),
            fields: def?.fields ?? [],
            outputs: lb.outputs ?? def?.outputs,
          } satisfies LogicNodeData,
        });
      });

      // Restore calc block nodes
      const storedCalcBlocks = (s.calcBlocks ?? canvasLayout?.calcBlocks ?? []) as {
        id?: string;
        type: string;
        config: Record<string, any>;
      }[];
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
            config: Object.fromEntries(
              Object.entries(cb.config).map(([k, v]) => [k, String(v)]),
            ),
            fields: def?.fields ?? [],
          } satisfies CalcNodeData,
        });
      });

      // Restore variable nodes from strategy.variables or canvas.variables
      const storedVariables = (s.variables ?? canvasLayout?.variables ?? []) as {
        id?: string;
        name: string;
        expression: string;
      }[];
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
          } as unknown as BlockNodeData,
        });
      });

      // Restore edges from canvas.connections if present
      const storedConnections = (canvasLayout?.connections ?? []) as { id?: string; source: string; sourceHandle?: string; target: string; targetHandle?: string }[];
      const edges: Edge[] = storedConnections.map(
        (c) => ({
          id: c.id || crypto.randomUUID(),
          source: c.source,
          sourceHandle: c.sourceHandle ?? null,
          target: c.target,
          targetHandle: c.targetHandle ?? null,
          type: 'smoothstep',
          animated: true,
        }),
      );

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
    } catch {
      set({ loading: false });
      throw new Error('Failed to load strategy');
    }
  },

  // ─── Save strategy ──────────────────────────────────────────────────────

  save: async () => {
    const state = get();
    if (!state.name.trim()) throw new Error('Name is required');

    set({ saving: true });

    const blockNodes = state.nodes.filter((n) => n.type === 'blockNode');
    const logicNodes = state.nodes.filter((n) => n.type === 'logicNode');
    const calcNodes = state.nodes.filter((n) => n.type === 'calcNode');
    const variableNodes = state.nodes.filter((n) => n.type === 'variableNode');

    const toBlock = (n: Node<BlockNodeData>) => ({
      id: n.id,
      type: (n.data as BlockNodeData).type,
      config: (n.data as BlockNodeData).config,
    });

    const toLogicBlock = (n: Node<LogicNodeData>) => ({
      id: n.id,
      type: (n.data as LogicNodeData).type,
      config: (n.data as LogicNodeData).config,
      outputs: (n.data as LogicNodeData).outputs,
    });

    const toCalcBlock = (n: Node<CalcNodeData>) => ({
      id: n.id,
      type: (n.data as CalcNodeData).type,
      config: (n.data as CalcNodeData).config,
    });

    const positions: Record<string, { x: number; y: number }> = {};
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
      name: (n.data as unknown as VariableNodeData).variableName,
      expression: (n.data as unknown as VariableNodeData).expression,
    }));

    const dto = {
      name: state.name.trim(),
      description: state.description.trim(),
      visibility: state.visibility,
      execMode: state.execMode,
      tickMs: Number(state.tickMs),
      safety: blockNodes
        .filter((n) => (n.data as BlockNodeData).section === 'safety')
        .map(toBlock),
      triggers: blockNodes
        .filter((n) => (n.data as BlockNodeData).section === 'triggers')
        .map(toBlock),
      conditions: blockNodes
        .filter((n) => (n.data as BlockNodeData).section === 'conditions')
        .map(toBlock),
      actions: blockNodes
        .filter((n) => (n.data as BlockNodeData).section === 'actions')
        .map(toBlock),
      logicBlocks: (logicNodes as Node<LogicNodeData>[]).map(toLogicBlock),
      calcBlocks: (calcNodes as Node<CalcNodeData>[]).map(toCalcBlock),
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
      const method = state.strategyId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('SESSION_EXPIRED');
        const err = await res.json().catch(() => ({})) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        throw new Error(err.message ?? 'Save failed');
      }

      const saved = await res.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      set({ strategyId: saved.id, saving: false, dirty: false });
      return saved;
    } catch (err: unknown) {
      set({ saving: false });
      throw err;
    }
  },

  // ─── Reset ──────────────────────────────────────────────────────────────

  reset: () => set(initialState()),
}));
