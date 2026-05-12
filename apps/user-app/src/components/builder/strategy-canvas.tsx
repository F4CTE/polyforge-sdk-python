import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Connection,
} from '@xyflow/react';
// Styles imported in globals.css (before our overrides)

import { BlockNode } from "./nodes/block-node";
import { VariableNode } from "./nodes/variable-node";
import { LogicNode } from "./nodes/logic-node";
import { CalcNode } from "./nodes/calc-node";
import {
  useBuilderStore,
  type BlockNodeData,
  type LogicNodeData,
  type CalcNodeData,
} from "../../stores/builder-store";
import { useExecutionStore } from "../../stores/execution-store";
import { useThemeStore } from "../../stores/theme-store";
import { ArrowLeftRight } from "lucide-react";
import { BLOCK_DEFS, type BlockSection } from "./block-definitions";

// ─── Keyboard connection: handle detection ──────────────────────────────────

type AnyNode = Node<BlockNodeData | LogicNodeData | CalcNodeData | Record<string, unknown>>;

function nodeHasSourceHandle(node: AnyNode): boolean {
  if (node.type === 'variableNode') return true;
  if (node.type === 'logicNode') return true;
  if (node.type === 'calcNode') return true;
  if (node.type === 'blockNode') {
    const section = (node.data as BlockNodeData).section;
    return section === 'triggers' || section === 'conditions';
  }
  return false;
}

function nodeHasTargetHandle(node: AnyNode): boolean {
  if (node.type === 'logicNode') return true;
  if (node.type === 'calcNode') return true;
  if (node.type === 'blockNode') {
    const section = (node.data as BlockNodeData).section;
    return section === 'conditions' || section === 'actions';
  }
  return false;
}

function getNodeLabel(node: AnyNode): string {
  const data = node.data as Record<string, unknown>;
  return String(data.variableName ?? data.label ?? node.type ?? 'Node');
}

function getDefaultSourceHandleId(node: AnyNode): string | null {
  if (node.type === 'variableNode') return null; // no explicit id
  if (node.type === 'blockNode') return null; // no explicit id
  if (node.type === 'logicNode') {
    const data = node.data as LogicNodeData;
    if (data.outputs && data.outputs.length > 1) return 'true-out';
    return 'output';
  }
  if (node.type === 'calcNode') return 'output';
  return null;
}

function getDefaultTargetHandleId(node: AnyNode): string | null {
  if (node.type === 'blockNode') return null; // no explicit id
  if (node.type === 'logicNode') return 'input';
  if (node.type === 'calcNode') {
    const data = node.data as CalcNodeData;
    const type = data.type as string;
    if (type === 'MATH' || type === 'COMPARISON') return 'input-a';
    return 'input';
  }
  return null;
}

// ─── Connection state machine ───────────────────────────────────────────────

type ConnState =
  | { phase: 'idle' }
  | { phase: 'source_selected'; sourceNodeId: string; sourceLabel: string }
  | { phase: 'connecting'; sourceNodeId: string; sourceLabel: string }
  | { phase: 'connected'; sourceLabel: string; targetLabel: string };

const CONN_ANNOUNCEMENTS: Record<ConnState['phase'], (s: ConnState) => string> = {
  idle: () => 'Canvas ready. Navigate between nodes with Tab or arrow keys. Press Enter on a source node to begin a connection.',
  source_selected: (s) => {
    const ss = s as { sourceLabel: string };
    return `Source selected: ${ss.sourceLabel}. Press C to start wiring. Press Escape to cancel.`;
  },
  connecting: (s) => {
    const ss = s as { sourceLabel: string };
    return `Wiring from ${ss.sourceLabel} in progress. Navigate to target node and press Enter to connect. Press Escape to cancel.`;
  },
  connected: (s) => {
    const ss = s as { sourceLabel: string; targetLabel: string };
    return `Connected ${ss.sourceLabel} to ${ss.targetLabel}.`;
  },
};

// ─── Node types registry ─────────────────────────────────────────────────────

const nodeTypes = {
  blockNode: BlockNode,
  variableNode: VariableNode,
  logicNode: LogicNode,
  calcNode: CalcNode,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function StrategyCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();

  const nodes = useBuilderStore((s) => s.nodes);
  const edges = useBuilderStore((s) => s.edges);
  const onNodesChange = useBuilderStore((s) => s.onNodesChange);
  const onEdgesChange = useBuilderStore((s) => s.onEdgesChange);
  const onConnect = useBuilderStore((s) => s.onConnect);
  const addNode = useBuilderStore((s) => s.addNode);

  const isLive = useExecutionStore((s) => s.liveRunning);
  const isBtRunning = useExecutionStore((s) => s.backtestRunning);
  const isExecuting = isLive || isBtRunning;

  // Brighten edges to vivid cyan while a strategy is executing
  const displayEdges = useMemo(() => {
    if (!isExecuting) return edges;
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        stroke: "color-mix(in srgb, var(--accent-default) 75%, transparent)",
        strokeWidth: 2,
        filter:
          "drop-shadow(0 0 4px color-mix(in srgb, var(--accent-default) 45%, transparent))",
      },
    }));
  }, [edges, isExecuting]);

  // ─── Drag-and-drop from palette ───────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;

      let parsed: { type: string; section: BlockSection };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const sectionDefs = BLOCK_DEFS[parsed.section];
      if (!sectionDefs) return;
      const def = sectionDefs.find((d) => d.type === parsed.type);
      if (!def) return;

      // screenToFlowPosition takes client coordinates directly in v12
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(def, parsed.section, {
        x: position.x - 130,
        y: position.y - 40,
      });
    },
    [addNode, reactFlow],
  );

  // ─── Theme-aware colors ──────────────────────────────────────────────

  const isDark = useThemeStore((s) => s.isDark);

  // ─── Keyboard connection state ────────────────────────────────────────────

  const [connState, setConnState] = useState<ConnState>({ phase: 'idle' });
  const [statusMsg, setStatusMsg] = useState('');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const msg = CONN_ANNOUNCEMENTS[connState.phase](connState);
    setStatusMsg(msg);

    if (connState.phase === 'connected') {
      statusTimer.current = setTimeout(() => {
        setConnState({ phase: 'idle' });
      }, 2000);
    }

    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [connState]);

  const resetConnection = useCallback(() => {
    setConnState({ phase: 'idle' });
  }, []);

  const onCanvasKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConnState({ phase: 'idle' });
        return;
      }

      // Find currently focused element — React Flow nodes have data-id
      const el = document.activeElement as HTMLElement | null;
      const nodeEl = el?.closest('[data-id]') as HTMLElement | null;
      const nodeId = nodeEl?.getAttribute('data-id');
      const node = nodeId ? reactFlow.getNode(nodeId) : null;

      if (!node) return;

      if (event.key === 'Enter') {
        event.preventDefault();

        if (connState.phase === 'source_selected') {
          setConnState({ phase: 'connecting', sourceNodeId: connState.sourceNodeId, sourceLabel: connState.sourceLabel });
          return;
        }

        if (connState.phase === 'connecting') {
          // Commit connection
          const sourceNode = reactFlow.getNode(connState.sourceNodeId);
          if (!sourceNode || !nodeHasSourceHandle(sourceNode)) return;
          if (!nodeHasTargetHandle(node)) return;

          const connection: Connection = {
            source: connState.sourceNodeId,
            sourceHandle: getDefaultSourceHandleId(sourceNode),
            target: node.id,
            targetHandle: getDefaultTargetHandleId(node),
          };

          onConnect(connection);
          setConnState({
            phase: 'connected',
            sourceLabel: connState.sourceLabel,
            targetLabel: getNodeLabel(node),
          });
          return;
        }

        if (connState.phase === 'idle' && nodeHasSourceHandle(node)) {
          setConnState({
            phase: 'source_selected',
            sourceNodeId: node.id,
            sourceLabel: getNodeLabel(node),
          });
          return;
        }
      }

      if (event.key === 'c' || event.key === 'C') {
        if (connState.phase === 'source_selected') {
          event.preventDefault();
          setConnState({ phase: 'connecting', sourceNodeId: connState.sourceNodeId, sourceLabel: connState.sourceLabel });
        }
      }
    },
    [connState, reactFlow, onConnect, resetConnection],
  );

  // ─── Empty state ──────────────────────────────────────────────────────

  const isEmpty = nodes.length === 0;

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative"
      aria-label="Strategy canvas editor"
      onKeyDown={onCanvasKeyDown}
    >
      {/* Screen reader status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMsg}
      </div>

      {/* Visual keyboard hint banner */}
      {connState.phase !== 'idle' && (
        <div
          aria-live="polite"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-default shadow-lg text-body-sm text-secondary"
        >
          <span className="text-info font-mono">
            {connState.phase === 'source_selected' && '⏎'}
            {connState.phase === 'connecting' && '🔗'}
            {connState.phase === 'connected' && '✓'}
          </span>
          <span>
            {connState.phase === 'source_selected' && `Source: ${connState.sourceLabel} — press C to start wiring`}
            {connState.phase === 'connecting' && `Wiring from ${connState.sourceLabel} — navigate & press Enter`}
            {connState.phase === 'connected' && `Connected ${connState.sourceLabel} → ${connState.targetLabel}`}
          </span>
          <button
            onClick={resetConnection}
            className="ml-2 px-2 py-0.5 text-label rounded border border-default hover:bg-surface transition-colors"
            aria-label="Cancel connection"
          >
            Esc
          </button>
        </div>
      )}
      <ReactFlow
        colorMode={isDark ? "dark" : "light"}
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView={nodes.length > 0}
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        nodesFocusable
        edgesFocusable
        selectNodesOnDrag={false}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        className="strategy-builder-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          className="!w-[180px] !h-[120px]"
          maskColor={
            isDark
              ? "color-mix(in srgb, var(--bg-app) 60%, transparent)"
              : "color-mix(in srgb, var(--bg-app) 60%, transparent)"
          }
          nodeColor={(node) => {
            if (node.type === "variableNode") return "var(--chart-category-2)";
            if (node.type === "logicNode") return "var(--info)";
            if (node.type === "calcNode") return "var(--gain)";
            const data = node.data as BlockNodeData;
            return data?.color ?? "var(--accent-text)";
          }}
          nodeStrokeWidth={2}
          nodeStrokeColor="transparent"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Empty state overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-surface border border-default flex items-center justify-center">
              <ArrowLeftRight
                className="size-8 text-tertiary opacity-50"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <p className="text-body-sm text-secondary font-medium">
              Drag a block from the panel to get started
            </p>
            <p className="text-label text-tertiary">
              Or click a block in the panel to add it
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
