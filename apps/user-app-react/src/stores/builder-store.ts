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
};

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
      const s = await res.json();

      const nodes: Node<BlockNodeData>[] = [];
      const canvasLayout = s.canvas as any;
      const storedPositions = canvasLayout?.positions || {};
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

      // Restore edges from canvas.connections if present
      const storedConnections = canvasLayout?.connections ?? [];
      const edges: Edge[] = storedConnections.map(
        (c: { id?: string; source: string; target: string }) => ({
          id: c.id || crypto.randomUUID(),
          source: c.source,
          target: c.target,
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

    const blocks = state.nodes;
    const toBlock = (n: Node<BlockNodeData>) => ({
      id: n.id,
      type: (n.data as BlockNodeData).type,
      config: (n.data as BlockNodeData).config,
    });

    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of blocks) {
      positions[n.id] = { x: n.position.x, y: n.position.y };
    }

    const connections = state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    const dto = {
      name: state.name.trim(),
      description: state.description.trim(),
      visibility: state.visibility,
      execMode: state.execMode,
      tickMs: Number(state.tickMs),
      safety: blocks
        .filter((n) => (n.data as BlockNodeData).section === 'safety')
        .map(toBlock),
      triggers: blocks
        .filter((n) => (n.data as BlockNodeData).section === 'triggers')
        .map(toBlock),
      conditions: blocks
        .filter((n) => (n.data as BlockNodeData).section === 'conditions')
        .map(toBlock),
      actions: blocks
        .filter((n) => (n.data as BlockNodeData).section === 'actions')
        .map(toBlock),
      tags: state.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
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
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  // ─── Reset ──────────────────────────────────────────────────────────────

  reset: () => set(initialState()),
}));
