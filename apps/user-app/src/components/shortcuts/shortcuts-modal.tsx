import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'M'], description: 'Go to Markets' },
      { keys: ['G', 'P'], description: 'Go to Portfolio' },
      { keys: ['G', 'S'], description: 'Go to Strategies' },
      { keys: ['G', 'L'], description: 'Go to Leaderboard' },
      { keys: ['G', 'A'], description: 'Go to Analytics' },
      { keys: ['G', 'F'], description: 'Go to Feed' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / dismiss' },
      { keys: ['⌘', '/'], description: 'Focus search' },
    ],
  },
  {
    title: 'Strategy Builder',
    shortcuts: [
      { keys: ['⌘', 'Z'], description: 'Undo last change' },
      { keys: ['⌘', 'Y'], description: 'Redo' },
      { keys: ['⌘', 'S'], description: 'Save strategy' },
      { keys: ['Del'], description: 'Delete selected block' },
    ],
  },
  {
    title: 'Markets',
    shortcuts: [
      { keys: ['W'], description: 'Add to / remove from watchlist' },
      { keys: ['B'], description: 'Quick buy YES' },
      { keys: ['S'], description: 'Quick sell / buy NO' },
      { keys: ['1', '2', '3'], description: 'Switch price history period' },
    ],
  },
  {
    title: 'Trading',
    shortcuts: [
      { keys: ['⌘', 'Enter'], description: 'Place order' },
      { keys: ['Esc'], description: 'Cancel order / reset form' },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label="Keyboard Shortcuts"
      onClick={onClose}
    >
      <div
        className="animate-fade-in bg-surface border border-default rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-secondary" />
            <h2 className="text-base font-semibold text-primary">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-sm text-secondary hover:bg-elevated hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Close shortcuts modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-label font-semibold text-tertiary uppercase tracking-wide mb-3">
                {group.title}
              </h3>
              <ul className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {shortcut.keys.map((key, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          <kbd className="inline-flex items-center px-2 py-1 rounded bg-elevated border border-default text-label font-mono text-primary">
                            {key}
                          </kbd>
                          {ki < shortcut.keys.length - 1 && (
                            <span className="text-label text-tertiary">+</span>
                          )}
                        </span>
                      ))}
                    </span>
                    <span className="text-body-sm text-secondary text-right">
                      {shortcut.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
