import { Zap, Blocks, ArrowRight, TrendingUp, RefreshCw, Calendar, Brain, Shuffle } from 'lucide-react';
import { Button } from '@polyforge/ui';

export type TemplateCategory = 'momentum' | 'mean-reversion' | 'event-based' | 'arbitrage' | 'sentiment';
export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TemplateData {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: TemplateDifficulty;
  emoji: string;
  estimatedWinRate: string;
  blockCount: number;
  edgeCount: number;
  forkCount: number;
  tags: string[];
}

const CATEGORY_ICONS: Record<TemplateCategory, React.ReactNode> = {
  momentum: <TrendingUp className="size-3" />,
  'mean-reversion': <RefreshCw className="size-3" />,
  'event-based': <Calendar className="size-3" />,
  sentiment: <Brain className="size-3" />,
  arbitrage: <Shuffle className="size-3" />,
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  momentum: 'Momentum',
  'mean-reversion': 'Mean Reversion',
  'event-based': 'Event',
  sentiment: 'Sentiment',
  arbitrage: 'Arbitrage',
};

function DifficultyDots({ difficulty }: { difficulty: TemplateDifficulty }) {
  const filled = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 2 : 3;
  return (
    <span className="flex items-center gap-1" aria-label={`Difficulty: ${difficulty}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block size-1.5 rounded-full ${
            i <= filled
              ? difficulty === 'beginner'
                ? 'bg-gain'
                : difficulty === 'intermediate'
                ? 'bg-warning'
                : 'bg-loss'
              : 'bg-default'
          }`}
        />
      ))}
      <span className={`ml-0.5 text-caption capitalize ${
        difficulty === 'beginner' ? 'text-gain' :
        difficulty === 'intermediate' ? 'text-warning' :
        'text-loss'
      }`}>{difficulty}</span>
    </span>
  );
}

interface TemplateCardProps {
  template: TemplateData;
  onPreview: (template: TemplateData) => void;
  onUse: (template: TemplateData) => void;
}

export function TemplateCard({ template, onPreview, onUse }: TemplateCardProps) {
  return (
    <div
      className="flex flex-col bg-surface border border-subtle rounded-lg p-4 hover:border-default transition-colors group"
      role="article"
      aria-label={`${template.name} strategy template`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl leading-none mt-0.5 shrink-0" aria-hidden="true">{template.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-body-md font-semibold text-primary truncate">{template.name}</h3>
          <DifficultyDots difficulty={template.difficulty} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-elevated border border-subtle text-caption text-tertiary">
          <Zap className="size-3 text-warning" aria-hidden="true" />
          {template.estimatedWinRate}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-elevated border border-subtle text-caption text-tertiary capitalize">
          {CATEGORY_ICONS[template.category]}
          {CATEGORY_LABELS[template.category]}
        </span>
      </div>

      <p className="text-label text-tertiary leading-relaxed flex-1 mb-3 line-clamp-2">{template.description}</p>

      <div className="flex items-center justify-between text-caption text-tertiary mb-3">
        <span className="flex items-center gap-1">
          <Blocks className="size-3" aria-hidden="true" />
          {template.blockCount} blocks
        </span>
        {template.forkCount > 0 && (
          <span>{template.forkCount} uses</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPreview(template)}
          className="flex-1"
        >
          Preview
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => onUse(template)}
          className="flex-1 flex items-center gap-1"
        >
          Use Template
          <ArrowRight className="size-3" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
