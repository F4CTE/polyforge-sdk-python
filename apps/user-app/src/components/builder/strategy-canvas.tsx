import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
// Styles imported in globals.css (before our overrides)

import { BlockNode } from './nodes/block-node';
import { VariableNode } from './nodes/variable-node';
import { LogicNode } from './nodes/logic-node';
import { CalcNode } from './nodes/calc-node';
import { useBuilderStore, type BlockNodeData, type LogicNodeData, type CalcNodeData } from '../../stores/builder-store';
import { useThemeStore } from '../../stores/theme-store';
import {
  BLOCK_DEFS,
  type BlockSection,
} from './block-definitions';

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

  // ─── Drag-and-drop from palette ───────────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      let parsed: { type: string; section: BlockSection };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const sectionDefs = BLOCK_DEFS[parsed.section];
      if (!sectionDefs) return;
      const def = sectionDefs.find(
        (d) => d.type === parsed.type,
      );
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

  // ─── Empty state ──────────────────────────────────────────────────────

  const isEmpty = nodes.length === 0;

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        colorMode={isDark ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView={nodes.length > 0}
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={['Backspace', 'Delete']}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
        className="strategy-builder-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
        />
        <Controls
          position="bottom-left"
          showInteractive={false}
        />
        <MiniMap
          position="bottom-right"
          style={{
            width: 180,
            height: 120,
            borderRadius: 12,
            border: '1px solid var(--color-pf-border)',
            backgroundColor: isDark
              ? 'color-mix(in srgb, var(--color-pf-base) 85%, transparent)'
              : 'color-mix(in srgb, var(--color-pf-surface) 90%, transparent)',
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-pf-lg)',
            overflow: 'hidden',
          }}
          maskColor={isDark
            ? 'color-mix(in srgb, var(--color-pf-base) 60%, transparent)'
            : 'color-mix(in srgb, var(--color-pf-base) 60%, transparent)'}
          nodeColor={(node) => {
            if (node.type === 'variableNode') return 'var(--color-pf-purple-500)';
            if (node.type === 'logicNode') return 'var(--color-pf-info)';
            if (node.type === 'calcNode') return 'var(--color-pf-success)';
            const data = node.data as BlockNodeData;
            return data?.color ?? 'var(--color-pf-cyan-400)';
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
            <div className="w-16 h-16 rounded-full bg-pf-surface border border-pf-border flex items-center justify-center">
              <svg
                className="size-8 text-pf-text-muted dark:opacity-40 opacity-60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
            <p className="text-sm text-pf-text-secondary font-medium">
              Drag a block from the panel to get started
            </p>
            <p className="text-xs text-pf-text-muted">
              Or click a block in the panel to add it
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
