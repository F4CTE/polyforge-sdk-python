import { useState, useCallback } from 'react';
import {
  Shield,
  Zap,
  Filter,
  Play,
  GripVertical,
  X,
  ChevronRight,
  Settings2,
  Variable,
  Plus,
} from 'lucide-react';
import {
  BLOCK_DEFS,
  SECTION_META,
  type BlockSection,
  type BlockDef,
} from './block-definitions';
import { useBuilderStore } from '../../stores/builder-store';

// ─── Section config ──────────────────────────────────────────────────────────

type PaletteTab = BlockSection | 'variables';

const SECTIONS: { key: PaletteTab; icon: React.ReactNode }[] = [
  { key: 'variables', icon: <Variable className="size-3" /> },
  { key: 'safety', icon: <Shield className="size-3" /> },
  { key: 'triggers', icon: <Zap className="size-3" /> },
  { key: 'conditions', icon: <Filter className="size-3" /> },
  { key: 'actions', icon: <Play className="size-3" /> },
];

const VARIABLE_TAB_META = { label: 'Variables', color: '#A855F7' };

// ─── Component ───────────────────────────────────────────────────────────────

interface BlockPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function BlockPalette({ open, onClose }: BlockPaletteProps) {
  const [activeSection, setActiveSection] = useState<PaletteTab>('safety');

  const name = useBuilderStore((s) => s.name);
  const description = useBuilderStore((s) => s.description);
  const execMode = useBuilderStore((s) => s.execMode);
  const tickMs = useBuilderStore((s) => s.tickMs);
  const visibility = useBuilderStore((s) => s.visibility);
  const tags = useBuilderStore((s) => s.tags);
  const nodes = useBuilderStore((s) => s.nodes);
  const setName = useBuilderStore((s) => s.setName);
  const setDescription = useBuilderStore((s) => s.setDescription);
  const setExecMode = useBuilderStore((s) => s.setExecMode);
  const setTickMs = useBuilderStore((s) => s.setTickMs);
  const setVisibility = useBuilderStore((s) => s.setVisibility);
  const setTags = useBuilderStore((s) => s.setTags);
  const addNode = useBuilderStore((s) => s.addNode);
  const addVariable = useBuilderStore((s) => s.addVariable);

  const sectionCount = useCallback(
    (section: PaletteTab) =>
      section === 'variables'
        ? nodes.filter((n) => n.type === 'variableNode').length
        : nodes.filter((n) => (n.data as any).section === section).length,
    [nodes],
  );

  const onDragStart = useCallback(
    (e: React.DragEvent, def: BlockDef, section: BlockSection) => {
      e.dataTransfer.setData(
        'application/reactflow',
        JSON.stringify({ type: def.type, section }),
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const onBlockClick = useCallback(
    (def: BlockDef) => {
      if (activeSection !== 'variables') {
        addNode(def, activeSection);
      }
    },
    [addNode, activeSection],
  );

  return (
    <div className="w-80 shrink-0 bg-pf-elevated border-l border-pf-border shadow-pf-lg flex flex-col overflow-x-hidden overflow-y-auto h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pf-border-subtle">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-pf-text-secondary" />
          <span className="text-sm font-medium text-pf-text">Strategy Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-pf-overlay text-pf-text-muted hover:text-pf-text transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Metadata form */}
        <div className="px-4 py-3 space-y-3 border-b border-pf-border-subtle">
          <div>
            <label className="block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Strategy Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Strategy"
              className="w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this strategy do?"
              className="w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Exec Mode
            </label>
            <select
              value={execMode}
              onChange={(e) => setExecMode(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
            >
              <option value="TICK">Tick - evaluate on timer</option>
              <option value="EVENT">Event - evaluate on price change</option>
              <option value="HYBRID">Hybrid - both timer and price change</option>
            </select>
          </div>

          {execMode !== 'EVENT' && (
            <div>
              <label className="block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
                Tick Interval (ms)
              </label>
              <input
                type="number"
                value={tickMs}
                onChange={(e) => setTickMs(Number(e.target.value))}
                placeholder="1000"
                min={200}
                className="w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
            >
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-pf-text-muted mb-1 uppercase tracking-wider">
              Tags <span className="font-normal opacity-60">(comma separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="momentum, politics"
              className="w-full px-2.5 py-1.5 text-sm bg-pf-surface border border-pf-border-subtle rounded-pf-sm text-pf-text placeholder:text-pf-text-muted/50 focus:outline-none focus:border-pf-cyan-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Block palette */}
        <div className="px-4 py-3">
          <h3 className="text-xs font-medium text-pf-text-secondary uppercase tracking-wider mb-2">
            Blocks
          </h3>

          {/* Section tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none">
            {SECTIONS.map(({ key, icon }) => {
              const meta = key === 'variables' ? VARIABLE_TAB_META : SECTION_META[key as BlockSection];
              const count = sectionCount(key);
              const isActive = activeSection === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-pf-sm text-[11px] font-medium transition-all shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'text-white shadow-pf-xs'
                      : 'text-pf-text-muted hover:text-pf-text-secondary bg-transparent hover:bg-pf-overlay'
                  }`}
                  style={isActive ? { backgroundColor: meta.color + 'CC' } : undefined}
                >
                  {icon}
                  {meta.label}
                  {count > 0 && (
                    <span
                      className="ml-0.5 px-1 py-px rounded-full text-[9px] font-semibold leading-none"
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : meta.color + '30',
                        color: isActive ? 'white' : meta.color,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Block list or Variables panel */}
          {activeSection === 'variables' ? (
            <div className="space-y-3">
              <p className="text-[10px] text-pf-text-muted leading-snug">
                Variables let you define reusable expressions. Reference them
                in block fields with <code className="text-purple-400 font-mono">$varName</code>.
              </p>
              <button
                onClick={addVariable}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-pf-sm text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: '#A855F7' }}
              >
                <Plus className="size-3.5" />
                Add Variable
              </button>
              {sectionCount('variables') > 0 && (
                <p className="text-[10px] text-pf-text-muted">
                  {sectionCount('variables')} variable{sectionCount('variables') !== 1 ? 's' : ''} on canvas
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {BLOCK_DEFS[activeSection as BlockSection].map((def) => (
                <div
                  key={def.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, def, activeSection as BlockSection)}
                  onClick={() => onBlockClick(def)}
                  className="group flex items-start gap-2 px-2.5 py-2 rounded-pf-sm cursor-pointer hover:bg-pf-overlay/60 transition-colors border border-transparent hover:border-pf-border-subtle"
                >
                  <GripVertical className="size-3 text-pf-text-muted/40 mt-0.5 shrink-0 cursor-grab group-hover:text-pf-text-muted" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-pf-text">{def.label}</span>
                      <ChevronRight className="size-3 text-pf-text-muted/0 group-hover:text-pf-text-muted/60 transition-all" />
                    </div>
                    <p className="text-[10px] text-pf-text-muted leading-snug mt-0.5">
                      {def.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
