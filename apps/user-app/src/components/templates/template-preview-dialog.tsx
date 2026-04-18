import { useCallback } from 'react';
import { X, Zap, Blocks, ArrowRight, Shield, Filter, Play, GitBranch, Calculator } from 'lucide-react';
import { Button } from '@polyforge/ui';
import type { TemplateData, TemplateDifficulty } from './template-card';

interface BlockSummary {
  section: string;
  type: string;
  label: string;
}

export interface TemplatePreviewData extends TemplateData {
  blocks: BlockSummary[];
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  safety: <Shield className="size-3" />,
  triggers: <Zap className="size-3" />,
  conditions: <Filter className="size-3" />,
  actions: <Play className="size-3" />,
  logic: <GitBranch className="size-3" />,
  calc: <Calculator className="size-3" />,
};

const SECTION_COLORS: Record<string, string> = {
  safety: 'text-loss',
  triggers: 'text-warning',
  conditions: 'text-info',
  actions: 'text-gain',
  logic: 'text-info',
  calc: 'text-gain',
};

function DifficultyLabel({ difficulty }: { difficulty: TemplateDifficulty }) {
  const cls = difficulty === 'beginner' ? 'bg-gain/10 border-gain/30 text-gain'
    : difficulty === 'intermediate' ? 'bg-warning/10 border-warning/30 text-warning'
    : 'bg-loss/10 border-loss/30 text-loss';
  return (
    <span className={`text-caption px-2 py-0.5 rounded border capitalize ${cls}`}>
      {difficulty}
    </span>
  );
}

interface TemplatePreviewDialogProps {
  template: TemplatePreviewData | null;
  onClose: () => void;
  onUse: (template: TemplatePreviewData) => void;
  loading?: boolean;
}

export function TemplatePreviewDialog({ template, onClose, onUse, loading }: TemplatePreviewDialogProps) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  if (!template) return null;

  const blocksBySection = template.blocks.reduce<Record<string, BlockSummary[]>>((acc, b) => {
    (acc[b.section] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-app/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${template.name}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-elevated border border-default rounded-xl shadow-lg max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-subtle shrink-0">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none mt-1" aria-hidden="true">{template.emoji}</span>
            <div>
              <h2 className="text-base font-semibold text-primary">{template.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <DifficultyLabel difficulty={template.difficulty} />
                <span className="inline-flex items-center gap-1 text-caption text-tertiary">
                  <Zap className="size-3 text-warning" aria-hidden="true" />
                  {template.estimatedWinRate}
                </span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-body-sm text-secondary leading-relaxed">{template.description}</p>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-caption text-tertiary">
            <span className="flex items-center gap-1">
              <Blocks className="size-3" aria-hidden="true" />
              {template.blockCount} blocks
            </span>
            <span>{template.edgeCount} connections</span>
            {template.forkCount > 0 && <span>{template.forkCount} uses</span>}
          </div>

          {/* Block composition */}
          <div>
            <h3 className="text-label font-medium text-secondary uppercase tracking-wider mb-2">Block Composition</h3>
            <div className="space-y-2">
              {Object.entries(blocksBySection).map(([section, blocks]) => (
                <div key={section} className="flex items-start gap-2">
                  <span className={`flex items-center gap-1 text-label font-medium capitalize w-24 shrink-0 ${SECTION_COLORS[section] ?? 'text-secondary'}`}>
                    {SECTION_ICONS[section]}
                    {section}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {blocks.map((b, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-surface border border-subtle text-caption text-primary">
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-surface border border-subtle text-caption text-tertiary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-subtle shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onUse(template)}
            disabled={loading}
            className="flex-1 flex items-center gap-1"
          >
            Use This Template
            <ArrowRight className="size-3" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
