import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Shield,
  Zap,
  Filter,
  Play,
  GitBranch,
  Calculator,
  GripVertical,
  X,
  ChevronRight,
  Settings2,
  Variable,
  Plus,
  Search,
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
  { key: 'logic', icon: <GitBranch className="size-3" /> },
  { key: 'calc', icon: <Calculator className="size-3" /> },
  { key: 'actions', icon: <Play className="size-3" /> },
];

const VARIABLE_TAB_META = { label: 'Variables', color: 'var(--chart-category-2)' };

// ─── Component ───────────────────────────────────────────────────────────────

interface BlockPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function BlockPalette({ open, onClose }: BlockPaletteProps) {
  const [activeSection, setActiveSection] = useState<PaletteTab>('safety');
  const [paletteSearch, setPaletteSearch] = useState('');
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const check = () => setTabsOverflow(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const name = useBuilderStore((s) => s.name);
  const description = useBuilderStore((s) => s.description);
  const execMode = useBuilderStore((s) => s.execMode);
  const tickMs = useBuilderStore((s) => s.tickMs);
  const visibility = useBuilderStore((s) => s.visibility);
  const tags = useBuilderStore((s) => s.tags);
  // Derive only node count per section to avoid re-renders on every node drag
  const nodeCountBySection = useBuilderStore((s) => {
    const counts: Record<string, number> = {};
    for (const n of s.nodes) {
      const section = n.type === 'variableNode' ? 'variables'
        : n.type === 'logicNode' ? 'logic'
        : n.type === 'calcNode' ? 'calc'
        : (n.data as Record<string, unknown>)?.section as string ?? 'unknown';
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

  const sectionCount = useCallback(
    (section: PaletteTab) => nodeCountBySection[section] ?? 0,
    [nodeCountBySection],
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
    <div className="w-80 shrink-0 bg-elevated border-l border-default shadow-lg flex flex-col overflow-x-hidden overflow-y-auto h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-secondary" />
          <span className="text-body-md font-medium text-primary">Strategy Settings</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="p-1 rounded hover:bg-overlay text-tertiary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Metadata form */}
        <div className="px-4 py-3 space-y-3 border-b border-subtle">
          <div>
            <label htmlFor="bp-strategy-name" className="block text-label font-medium text-tertiary mb-1 uppercase tracking-wider">
              Strategy Name *
            </label>
            <input
              id="bp-strategy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => setName(e.target.value)}
              placeholder="My Strategy"
              aria-required="true"
              className="w-full px-3 py-2 text-body-md bg-surface border border-subtle rounded-sm text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="bp-strategy-description" className="block text-label font-medium text-tertiary mb-1 uppercase tracking-wider">
              Description
            </label>
            <textarea
              id="bp-strategy-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={(e) => setDescription(e.target.value)}
              placeholder="What does this strategy do?"
              aria-label="Strategy description"
              className="w-full px-3 py-2 text-body-md bg-surface border border-subtle rounded-sm text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:border-accent/50 transition-colors resize-none"
            />
          </div>

          <div>
            <label htmlFor="bp-exec-mode" className="block text-label font-medium text-tertiary mb-1 uppercase tracking-wider">
              Exec Mode
            </label>
            <select
              id="bp-exec-mode"
              value={execMode}
              onChange={(e) => setExecMode(e.target.value)}
              aria-label="Execution mode"
              className="w-full px-3 py-2 text-body-md bg-surface border border-subtle rounded-sm text-primary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
            >
              <option value="TICK">Tick - evaluate on timer</option>
              <option value="EVENT">Event - evaluate on price change</option>
              <option value="HYBRID">Hybrid - both timer and price change</option>
            </select>
          </div>

          {execMode !== 'EVENT' && (
            <div>
              <label htmlFor="bp-tick-interval" className="block text-label font-medium text-tertiary mb-1 uppercase tracking-wider">
                Tick Interval (ms)
              </label>
              <input
                id="bp-tick-interval"
                type="number"
                value={tickMs}
                onChange={(e) => setTickMs(Number(e.target.value))}
                onBlur={(e) => setTickMs(Number(e.target.value))}
                placeholder="1000"
                min={200}
                aria-label="Tick interval in milliseconds"
                className="w-full px-3 py-2 text-body-md bg-surface border border-subtle rounded-sm text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
              />
            </div>
          )}

          <div>
            <label htmlFor="bp-visibility" className="block text-label font-medium text-tertiary mb-1 uppercase tracking-wider">
              Visibility
            </label>
            <select
              id="bp-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              aria-label="Strategy visibility"
              className="w-full px-3 py-2 text-body-md bg-surface border border-subtle rounded-sm text-primary focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
            >
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>

          <div>
            <label htmlFor="bp-strategy-tags" className="block text-label font-medium text-tertiary mb-1 uppercase tracking-wider">
              Tags <span className="font-normal opacity-60">(comma separated)</span>
            </label>
            <input
              id="bp-strategy-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              onBlur={(e) => setTags(e.target.value)}
              placeholder="momentum, politics"
              aria-label="Strategy tags, comma-separated"
              className="w-full px-3 py-2 text-body-md bg-surface border border-subtle rounded-sm text-primary placeholder:text-tertiary/50 focus-visible:outline-none focus-visible:border-accent/50 transition-colors"
            />
          </div>
        </div>

        {/* Block palette */}
        <div className="px-4 py-3">
          <h3 className="text-label font-medium text-secondary uppercase tracking-wider mb-2">
            Blocks
          </h3>

          {/* Section tabs */}
          <div className="relative mb-3">
            <div ref={tabBarRef} className="flex gap-1 overflow-x-auto scrollbar-none">
            {SECTIONS.map(({ key, icon }) => {
              const meta = key === 'variables' ? VARIABLE_TAB_META : SECTION_META[key as BlockSection];
              const count = sectionCount(key);
              const isActive = activeSection === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setActiveSection(key)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1 px-2 py-1 rounded-sm text-label font-medium transition-all shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    isActive
                      ? 'text-primary shadow-xs'
                      : 'text-tertiary hover:text-secondary bg-transparent hover:bg-overlay'
                  }`}
                  style={isActive ? { backgroundColor: `color-mix(in srgb, ${meta.color} 80%, transparent)` } : undefined}
                >
                  {/* dynamic-color: intentional — color is runtime chart palette value */}
                  {icon}
                  {meta.label}
                  {count > 0 && (
                    <span
                      data-testid="block-count"
                      className="ml-1 px-1 py-px rounded-full text-caption font-semibold leading-none"
                      style={{
                        backgroundColor: isActive ? 'color-mix(in srgb, var(--text-primary) 25%, transparent)' : `color-mix(in srgb, ${meta.color} 19%, transparent)`,
                        color: isActive ? 'var(--text-inverse)' : meta.color,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            </div>
            {tabsOverflow && (
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-elevated to-transparent" />
            )}
          </div>

          {/* Block list or Variables panel */}
          {activeSection === 'variables' ? (
            <div className="space-y-3">
              <p className="text-caption text-tertiary leading-snug">
                Variables let you define reusable expressions. Reference them
                in block fields with <code className="text-variable font-mono">$varName</code>.
              </p>
              <button
                type="button"
                onClick={addVariable}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-sm text-label font-medium text-primary transition-colors hover:opacity-90 bg-variable focus-visible:outline-none focus-visible:shadow-focus-ring"
              >
                <Plus className="size-4" />
                Add Variable
              </button>
              {sectionCount('variables') > 0 && (
                <p className="text-caption text-tertiary">
                  {sectionCount('variables')} variable{sectionCount('variables') !== 1 ? 's' : ''} on canvas
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Search input */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-tertiary" />
                <input
                  type="text"
                  placeholder="Search blocks..."
                  value={paletteSearch}
                  onChange={e => setPaletteSearch(e.target.value)}
                  aria-label="Search blocks"
                  className="w-full pl-7 pr-2 py-2 text-label bg-surface border border-default rounded-pf text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:border-accent/50"
                />
              </div>
              {(() => {
                const q = paletteSearch.toLowerCase();
                const sectionLabel = SECTION_META[activeSection as BlockSection]?.label ?? '';
                const filtered = BLOCK_DEFS[activeSection as BlockSection].filter(def =>
                  !q ||
                  def.label.toLowerCase().includes(q) ||
                  def.description.toLowerCase().includes(q) ||
                  def.group?.toLowerCase().includes(q) ||
                  sectionLabel.toLowerCase().includes(q)
                );
                if (filtered.length === 0) {
                  return (
                    <p className="text-label text-tertiary px-1 py-2">No blocks match</p>
                  );
                }
                const renderedGroups = new Set<string>();
                return filtered.map((def) => {
                  const groupHeader = def.group && !renderedGroups.has(def.group)
                    ? (() => { renderedGroups.add(def.group!); return def.group; })()
                    : null;
                  return (
                    <div key={def.type}>
                      {groupHeader && (
                        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                          <span className="text-caption font-semibold text-secondary uppercase tracking-wider">{groupHeader}</span>
                          <div className="flex-1 h-px bg-subtle" />
                        </div>
                      )}
                      <div
                        draggable
                        role="button"
                        tabIndex={0}
                        aria-label={`Add ${def.label} block`}
                        onDragStart={(e) => onDragStart(e, def, activeSection as BlockSection)}
                        onClick={() => onBlockClick(def)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBlockClick(def); } }}
                        className="group flex items-start gap-2 px-3 py-2 rounded-sm cursor-pointer hover:bg-overlay/60 transition-colors border border-transparent hover:border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        <GripVertical className="size-3 text-tertiary/40 mt-1 shrink-0 cursor-grab group-hover:text-tertiary" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-label font-medium text-primary">{def.label}</span>
                            <ChevronRight className="size-3 text-tertiary/0 group-hover:text-tertiary/60 transition-all" />
                          </div>
                          <p className="text-caption text-tertiary leading-snug mt-1">
                            {def.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
