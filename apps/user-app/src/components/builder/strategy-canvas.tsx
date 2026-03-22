import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { BlockNode } from './nodes/block-node';
import { useBuilderStore, type BlockNodeData } from '../../stores/builder-store';
import { useThemeStore } from '../../stores/theme-store';
import {
  BLOCK_DEFS,
  type BlockSection,
} from './block-definitions';

// ─── Node types registry ─────────────────────────────────────────────────────

const nodeTypes = {
  blockNode: BlockNode,
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

      const def = BLOCK_DEFS[parsed.section].find(
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
  const dotColor = isDark ? '#334155' : '#cbd5e1';

  // ─── Empty state ──────────────────────────────────────────────────────

  const isEmpty = nodes.length === 0;

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
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
        style={{ background: 'var(--color-pf-base)' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2}
          color={dotColor}
        />
        <Controls
          showInteractive={false}
          className="!bg-pf-elevated !border-pf-border !rounded-pf-md !shadow-pf-md [&>button]:!bg-pf-elevated [&>button]:!border-pf-border-subtle [&>button]:!text-pf-text-secondary [&>button:hover]:!bg-pf-overlay"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as BlockNodeData;
            return data?.color ?? '#6B7280';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          className="!bg-pf-surface !border-pf-border !rounded-pf-md"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Empty state overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-pf-surface border border-pf-border-subtle flex items-center justify-center">
              <svg
                className="size-8 text-pf-text-muted/30"
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
