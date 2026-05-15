import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { ArrowLeft, Check, Loader2, Pencil, Blocks, Upload, Zap, FlaskConical, HelpCircle, Target, RotateCcw, RotateCw, LayoutTemplate, X, TrendingUp, RefreshCw, Calendar, Brain, AlertCircle, ChevronRight, Search } from 'lucide-react';
import { Button, Input } from '@polyforge/ui';
import { useBetaUsage } from '@/hooks/use-beta-usage';
import { toast } from 'sonner';
import type { Node, Edge } from '@xyflow/react';
import type { BlockNodeData } from '../../stores/builder-store';
import { SECTION_COLUMNS } from '../../components/builder/block-definitions';

import { StrategyCanvas } from '../../components/builder/strategy-canvas';
import { BlockPalette } from '../../components/builder/block-palette';
import { BuilderTutorial } from '../../components/builder/builder-tutorial';
import { ExecutionPanel } from '../../components/builder/execution-panel';
import { useBuilderStore } from '../../stores/builder-store';
import { capture } from '@/lib/analytics';

// ─── Strategy Template Library ───────────────────────────────────────────────

type TemplateCategory = 'momentum' | 'mean-reversion' | 'event-based' | 'arbitrage' | 'sentiment';
type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';

interface TemplateBlock {
  id: string;
  nodeType: 'blockNode' | 'logicNode';
  type: string;
  label: string;
  section: 'safety' | 'triggers' | 'conditions' | 'actions' | 'logic';
  color: string;
  config: Record<string, string>;
  fields: Array<{ key: string; label: string; type: string; placeholder: string; options?: string[]; wireable?: boolean }>;
  position: { x: number; y: number };
}

interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: TemplateDifficulty;
  emoji: string;
  estimatedWinRate: string;
  blocks: TemplateBlock[];
  edges: TemplateEdge[];
}

const SECTION_COLORS_STATIC: Record<string, string> = {
  safety: 'var(--loss)',
  triggers: 'var(--warning)',
  conditions: 'var(--info)',
  actions: 'var(--gain)',
  logic: 'var(--info)',
};

const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'momentum-basic',
    name: 'Momentum Follower',
    description: 'Buy YES when price rises more than 5% within a 1-hour window. Ideal for trending markets with clear directional momentum.',
    category: 'momentum',
    difficulty: 'beginner',
    emoji: '🚀',
    estimatedWinRate: '62-68%',
    blocks: [
      {
        id: 'tmpl-mb-safety-1',
        nodeType: 'blockNode',
        type: 'stop_if_daily_loss',
        label: 'Stop on Daily Loss',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { maxLossUsdc: '150' },
        fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '200', wireable: true }],
        position: { x: SECTION_COLUMNS.safety, y: 100 },
      },
      {
        id: 'tmpl-mb-trigger-1',
        nodeType: 'blockNode',
        type: 'price_change_pct',
        label: 'Price Change %',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', pct: '5', windowMs: '3600000' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'pct', label: 'Change %', type: 'number', placeholder: '5' },
          { key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '60000' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 100 },
      },
      {
        id: 'tmpl-mb-cond-1',
        nodeType: 'blockNode',
        type: 'min_liquidity',
        label: 'Min Liquidity',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { minUsdc: '500' },
        fields: [{ key: 'minUsdc', label: 'Min USDC', type: 'number', placeholder: '100' }],
        position: { x: SECTION_COLUMNS.conditions, y: 100 },
      },
      {
        id: 'tmpl-mb-cond-2',
        nodeType: 'blockNode',
        type: 'max_spread',
        label: 'Max Spread',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { maxSpread: '0.05' },
        fields: [{ key: 'maxSpread', label: 'Max Spread', type: 'number', placeholder: '0.04' }],
        position: { x: SECTION_COLUMNS.conditions, y: 300 },
      },
      {
        id: 'tmpl-mb-action-1',
        nodeType: 'blockNode',
        type: 'buy_yes',
        label: 'Buy YES',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A', size: '50' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        ],
        position: { x: SECTION_COLUMNS.actions, y: 100 },
      },
      {
        id: 'tmpl-mb-action-2',
        nodeType: 'blockNode',
        type: 'set_take_profit',
        label: 'Set Take Profit',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '25' },
        fields: [{ key: 'pct', label: 'Take Profit (%)', type: 'number', placeholder: '20' }],
        position: { x: SECTION_COLUMNS.actions, y: 300 },
      },
    ],
    edges: [
      { id: 'tmpl-mb-e1', source: 'tmpl-mb-trigger-1', target: 'tmpl-mb-cond-1' },
      { id: 'tmpl-mb-e2', source: 'tmpl-mb-cond-1', target: 'tmpl-mb-cond-2' },
      { id: 'tmpl-mb-e3', source: 'tmpl-mb-cond-2', target: 'tmpl-mb-action-1' },
      { id: 'tmpl-mb-e4', source: 'tmpl-mb-action-1', target: 'tmpl-mb-action-2' },
    ],
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    description: 'Buy when price drops more than 15% below its 7-day average. Profits from temporary overselling and eventual price correction.',
    category: 'mean-reversion',
    difficulty: 'intermediate',
    emoji: '📉',
    estimatedWinRate: '58-65%',
    blocks: [
      {
        id: 'tmpl-mr-safety-1',
        nodeType: 'blockNode',
        type: 'stop_if_daily_loss',
        label: 'Stop on Daily Loss',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { maxLossUsdc: '200' },
        fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '200', wireable: true }],
        position: { x: SECTION_COLUMNS.safety, y: 100 },
      },
      {
        id: 'tmpl-mr-safety-2',
        nodeType: 'blockNode',
        type: 'stop_if_drawdown',
        label: 'Max Drawdown',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { maxDrawdownPct: '15' },
        fields: [{ key: 'maxDrawdownPct', label: 'Max Drawdown (%)', type: 'number', placeholder: '10' }],
        position: { x: SECTION_COLUMNS.safety, y: 300 },
      },
      {
        id: 'tmpl-mr-trigger-1',
        nodeType: 'blockNode',
        type: 'price_change_pct',
        label: 'Price Change %',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', pct: '-15', windowMs: '604800000' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'pct', label: 'Change %', type: 'number', placeholder: '5' },
          { key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '60000' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 100 },
      },
      {
        id: 'tmpl-mr-cond-1',
        nodeType: 'blockNode',
        type: 'min_liquidity',
        label: 'Min Liquidity',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { minUsdc: '1000' },
        fields: [{ key: 'minUsdc', label: 'Min USDC', type: 'number', placeholder: '100' }],
        position: { x: SECTION_COLUMNS.conditions, y: 100 },
      },
      {
        id: 'tmpl-mr-cond-2',
        nodeType: 'blockNode',
        type: 'no_recent_bet',
        label: 'No Recent Bet',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { windowMs: '86400000' },
        fields: [{ key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '300000' }],
        position: { x: SECTION_COLUMNS.conditions, y: 300 },
      },
      {
        id: 'tmpl-mr-action-1',
        nodeType: 'blockNode',
        type: 'buy_yes',
        label: 'Buy YES',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A', size: '75' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        ],
        position: { x: SECTION_COLUMNS.actions, y: 100 },
      },
      {
        id: 'tmpl-mr-action-2',
        nodeType: 'blockNode',
        type: 'set_stop_loss',
        label: 'Set Stop Loss',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '8' },
        fields: [{ key: 'pct', label: 'Stop Loss (%)', type: 'number', placeholder: '10' }],
        position: { x: SECTION_COLUMNS.actions, y: 300 },
      },
    ],
    edges: [
      { id: 'tmpl-mr-e1', source: 'tmpl-mr-trigger-1', target: 'tmpl-mr-cond-1' },
      { id: 'tmpl-mr-e2', source: 'tmpl-mr-cond-1', target: 'tmpl-mr-cond-2' },
      { id: 'tmpl-mr-e3', source: 'tmpl-mr-cond-2', target: 'tmpl-mr-action-1' },
      { id: 'tmpl-mr-e4', source: 'tmpl-mr-action-1', target: 'tmpl-mr-action-2' },
    ],
  },
  {
    id: 'event-based',
    name: 'Event Trader',
    description: 'Enter a position 24 hours before a market closes, then exit at resolution. Captures the final price convergence as the outcome becomes clear.',
    category: 'event-based',
    difficulty: 'beginner',
    emoji: '📅',
    estimatedWinRate: '55-60%',
    blocks: [
      {
        id: 'tmpl-ev-safety-1',
        nodeType: 'blockNode',
        type: 'max_daily_bets',
        label: 'Max Daily Bets',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { count: '3' },
        fields: [{ key: 'count', label: 'Max bets per day', type: 'number', placeholder: '10' }],
        position: { x: SECTION_COLUMNS.safety, y: 100 },
      },
      {
        id: 'tmpl-ev-trigger-1',
        nodeType: 'blockNode',
        type: 'market_resolving',
        label: 'Market Resolving',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: {},
        fields: [],
        position: { x: SECTION_COLUMNS.triggers, y: 100 },
      },
      {
        id: 'tmpl-ev-cond-1',
        nodeType: 'blockNode',
        type: 'market_open',
        label: 'Market Open',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: {},
        fields: [],
        position: { x: SECTION_COLUMNS.conditions, y: 100 },
      },
      {
        id: 'tmpl-ev-cond-2',
        nodeType: 'blockNode',
        type: 'min_liquidity',
        label: 'Min Liquidity',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { minUsdc: '2000' },
        fields: [{ key: 'minUsdc', label: 'Min USDC', type: 'number', placeholder: '100' }],
        position: { x: SECTION_COLUMNS.conditions, y: 300 },
      },
      {
        id: 'tmpl-ev-action-1',
        nodeType: 'blockNode',
        type: 'buy_yes',
        label: 'Buy YES',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A', size: '40' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        ],
        position: { x: SECTION_COLUMNS.actions, y: 100 },
      },
      {
        id: 'tmpl-ev-trigger-2',
        nodeType: 'blockNode',
        type: 'market_resolved',
        label: 'Market Resolved',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: {},
        fields: [],
        position: { x: SECTION_COLUMNS.triggers, y: 300 },
      },
      {
        id: 'tmpl-ev-action-2',
        nodeType: 'blockNode',
        type: 'close_position',
        label: 'Close Position',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A' },
        fields: [{ key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' }],
        position: { x: SECTION_COLUMNS.actions, y: 300 },
      },
    ],
    edges: [
      { id: 'tmpl-ev-e1', source: 'tmpl-ev-trigger-1', target: 'tmpl-ev-cond-1' },
      { id: 'tmpl-ev-e2', source: 'tmpl-ev-cond-1', target: 'tmpl-ev-cond-2' },
      { id: 'tmpl-ev-e3', source: 'tmpl-ev-cond-2', target: 'tmpl-ev-action-1' },
      { id: 'tmpl-ev-e4', source: 'tmpl-ev-trigger-2', target: 'tmpl-ev-action-2' },
    ],
  },
  {
    id: 'sentiment-driven',
    name: 'Sentiment Rider',
    description: 'Enter when community sentiment is strongly bullish: high YES volume with a spread tight enough to suggest conviction rather than speculation.',
    category: 'sentiment',
    difficulty: 'intermediate',
    emoji: '🧠',
    estimatedWinRate: '60-67%',
    blocks: [
      {
        id: 'tmpl-sd-safety-1',
        nodeType: 'blockNode',
        type: 'stop_if_consecutive_losses',
        label: 'Stop on Streak Losses',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { count: '3' },
        fields: [{ key: 'count', label: 'Max consecutive losses', type: 'number', placeholder: '3' }],
        position: { x: SECTION_COLUMNS.safety, y: 100 },
      },
      {
        id: 'tmpl-sd-trigger-1',
        nodeType: 'blockNode',
        type: 'volume_spike',
        label: 'Volume Spike',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', multiplier: '2.5' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'multiplier', label: 'Multiplier', type: 'number', placeholder: '3' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 100 },
      },
      {
        id: 'tmpl-sd-cond-1',
        nodeType: 'blockNode',
        type: 'price_above',
        label: 'Price Above',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { marketSlot: '$MARKET_A', threshold: '0.55' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.60' },
        ],
        position: { x: SECTION_COLUMNS.conditions, y: 100 },
      },
      {
        id: 'tmpl-sd-cond-2',
        nodeType: 'blockNode',
        type: 'max_spread',
        label: 'Max Spread',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { maxSpread: '0.04' },
        fields: [{ key: 'maxSpread', label: 'Max Spread', type: 'number', placeholder: '0.04' }],
        position: { x: SECTION_COLUMNS.conditions, y: 300 },
      },
      {
        id: 'tmpl-sd-cond-3',
        nodeType: 'blockNode',
        type: 'no_recent_bet',
        label: 'No Recent Bet',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { windowMs: '3600000' },
        fields: [{ key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '300000' }],
        position: { x: SECTION_COLUMNS.conditions, y: 500 },
      },
      {
        id: 'tmpl-sd-action-1',
        nodeType: 'blockNode',
        type: 'buy_yes',
        label: 'Buy YES',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A', size: '60' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        ],
        position: { x: SECTION_COLUMNS.actions, y: 100 },
      },
      {
        id: 'tmpl-sd-action-2',
        nodeType: 'blockNode',
        type: 'set_take_profit',
        label: 'Set Take Profit',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '30' },
        fields: [{ key: 'pct', label: 'Take Profit (%)', type: 'number', placeholder: '20' }],
        position: { x: SECTION_COLUMNS.actions, y: 300 },
      },
    ],
    edges: [
      { id: 'tmpl-sd-e1', source: 'tmpl-sd-trigger-1', target: 'tmpl-sd-cond-1' },
      { id: 'tmpl-sd-e2', source: 'tmpl-sd-cond-1', target: 'tmpl-sd-cond-2' },
      { id: 'tmpl-sd-e3', source: 'tmpl-sd-cond-2', target: 'tmpl-sd-cond-3' },
      { id: 'tmpl-sd-e4', source: 'tmpl-sd-cond-3', target: 'tmpl-sd-action-1' },
      { id: 'tmpl-sd-e5', source: 'tmpl-sd-action-1', target: 'tmpl-sd-action-2' },
    ],
  },
  {
    id: 'momentum-advanced',
    name: 'Multi-Signal Momentum',
    description: 'Combines price movement, volume surge, and liquidity signals through an AND gate for high-confidence momentum entries with strict risk controls.',
    category: 'momentum',
    difficulty: 'advanced',
    emoji: '⚡',
    estimatedWinRate: '65-72%',
    blocks: [
      {
        id: 'tmpl-ma-safety-1',
        nodeType: 'blockNode',
        type: 'stop_if_daily_loss',
        label: 'Stop on Daily Loss',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { maxLossUsdc: '300' },
        fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '200', wireable: true }],
        position: { x: SECTION_COLUMNS.safety, y: 100 },
      },
      {
        id: 'tmpl-ma-safety-2',
        nodeType: 'blockNode',
        type: 'stop_if_drawdown',
        label: 'Max Drawdown',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { maxDrawdownPct: '12' },
        fields: [{ key: 'maxDrawdownPct', label: 'Max Drawdown (%)', type: 'number', placeholder: '10' }],
        position: { x: SECTION_COLUMNS.safety, y: 300 },
      },
      {
        id: 'tmpl-ma-trigger-1',
        nodeType: 'blockNode',
        type: 'price_change_pct',
        label: 'Price Change %',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', pct: '7', windowMs: '1800000' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'pct', label: 'Change %', type: 'number', placeholder: '5' },
          { key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '60000' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 100 },
      },
      {
        id: 'tmpl-ma-trigger-2',
        nodeType: 'blockNode',
        type: 'volume_spike',
        label: 'Volume Spike',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', multiplier: '3' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'multiplier', label: 'Multiplier', type: 'number', placeholder: '3' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 300 },
      },
      {
        id: 'tmpl-ma-logic-1',
        nodeType: 'logicNode',
        type: 'AND_GATE',
        label: 'AND',
        section: 'logic',
        color: 'var(--info)',
        config: {},
        fields: [],
        position: { x: 1050, y: 200 },
      },
      {
        id: 'tmpl-ma-cond-1',
        nodeType: 'blockNode',
        type: 'liquidity_above',
        label: 'Liquidity Above',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { marketSlot: '$MARKET_A', minLiquidity: '2000' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'minLiquidity', label: 'Min Liquidity (USDC)', type: 'number', placeholder: '1000' },
        ],
        position: { x: SECTION_COLUMNS.conditions, y: 100 },
      },
      {
        id: 'tmpl-ma-cond-2',
        nodeType: 'blockNode',
        type: 'max_spread',
        label: 'Max Spread',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { maxSpread: '0.03' },
        fields: [{ key: 'maxSpread', label: 'Max Spread', type: 'number', placeholder: '0.04' }],
        position: { x: SECTION_COLUMNS.conditions, y: 300 },
      },
      {
        id: 'tmpl-ma-cond-3',
        nodeType: 'blockNode',
        type: 'no_recent_bet',
        label: 'No Recent Bet',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { windowMs: '1800000' },
        fields: [{ key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '300000' }],
        position: { x: SECTION_COLUMNS.conditions, y: 500 },
      },
      {
        id: 'tmpl-ma-action-1',
        nodeType: 'blockNode',
        type: 'buy_yes',
        label: 'Buy YES',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A', size: '100' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        ],
        position: { x: SECTION_COLUMNS.actions, y: 100 },
      },
      {
        id: 'tmpl-ma-action-2',
        nodeType: 'blockNode',
        type: 'set_stop_loss',
        label: 'Set Stop Loss',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '8' },
        fields: [{ key: 'pct', label: 'Stop Loss (%)', type: 'number', placeholder: '10' }],
        position: { x: SECTION_COLUMNS.actions, y: 300 },
      },
      {
        id: 'tmpl-ma-action-3',
        nodeType: 'blockNode',
        type: 'set_take_profit',
        label: 'Set Take Profit',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '35' },
        fields: [{ key: 'pct', label: 'Take Profit (%)', type: 'number', placeholder: '20' }],
        position: { x: SECTION_COLUMNS.actions, y: 500 },
      },
    ],
    edges: [
      { id: 'tmpl-ma-e1', source: 'tmpl-ma-trigger-1', target: 'tmpl-ma-logic-1' },
      { id: 'tmpl-ma-e2', source: 'tmpl-ma-trigger-2', target: 'tmpl-ma-logic-1' },
      { id: 'tmpl-ma-e3', source: 'tmpl-ma-logic-1', target: 'tmpl-ma-cond-1' },
      { id: 'tmpl-ma-e4', source: 'tmpl-ma-cond-1', target: 'tmpl-ma-cond-2' },
      { id: 'tmpl-ma-e5', source: 'tmpl-ma-cond-2', target: 'tmpl-ma-cond-3' },
      { id: 'tmpl-ma-e6', source: 'tmpl-ma-cond-3', target: 'tmpl-ma-action-1' },
      { id: 'tmpl-ma-e7', source: 'tmpl-ma-action-1', target: 'tmpl-ma-action-2' },
      { id: 'tmpl-ma-e8', source: 'tmpl-ma-action-2', target: 'tmpl-ma-action-3' },
    ],
  },
  {
    id: 'contrarian',
    name: 'Contrarian',
    description: 'Buy NO when the crowd overwhelmingly says YES. Exploits market overconfidence and herding behavior — typically when YES price exceeds 80%.',
    category: 'sentiment',
    difficulty: 'advanced',
    emoji: '🔄',
    estimatedWinRate: '52-58%',
    blocks: [
      {
        id: 'tmpl-ct-safety-1',
        nodeType: 'blockNode',
        type: 'stop_if_daily_loss',
        label: 'Stop on Daily Loss',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { maxLossUsdc: '200' },
        fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '200', wireable: true }],
        position: { x: SECTION_COLUMNS.safety, y: 100 },
      },
      {
        id: 'tmpl-ct-safety-2',
        nodeType: 'blockNode',
        type: 'stop_if_consecutive_losses',
        label: 'Stop on Streak Losses',
        section: 'safety',
        color: SECTION_COLORS_STATIC.safety,
        config: { count: '4' },
        fields: [{ key: 'count', label: 'Max consecutive losses', type: 'number', placeholder: '3' }],
        position: { x: SECTION_COLUMNS.safety, y: 300 },
      },
      {
        id: 'tmpl-ct-trigger-1',
        nodeType: 'blockNode',
        type: 'price_above',
        label: 'Price Above',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', threshold: '0.80' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.60' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 100 },
      },
      {
        id: 'tmpl-ct-trigger-2',
        nodeType: 'blockNode',
        type: 'volume_spike',
        label: 'Volume Spike',
        section: 'triggers',
        color: SECTION_COLORS_STATIC.triggers,
        config: { marketSlot: '$MARKET_A', multiplier: '2' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'multiplier', label: 'Multiplier', type: 'number', placeholder: '3' },
        ],
        position: { x: SECTION_COLUMNS.triggers, y: 300 },
      },
      {
        id: 'tmpl-ct-logic-1',
        nodeType: 'logicNode',
        type: 'AND_GATE',
        label: 'AND',
        section: 'logic',
        color: 'var(--info)',
        config: {},
        fields: [],
        position: { x: 1050, y: 200 },
      },
      {
        id: 'tmpl-ct-cond-1',
        nodeType: 'blockNode',
        type: 'max_price',
        label: 'Max Price',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { marketSlot: '$MARKET_A', maxPrice: '0.92' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'maxPrice', label: 'Max Price', type: 'number', placeholder: '0.90' },
        ],
        position: { x: SECTION_COLUMNS.conditions, y: 100 },
      },
      {
        id: 'tmpl-ct-cond-2',
        nodeType: 'blockNode',
        type: 'min_liquidity',
        label: 'Min Liquidity',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { minUsdc: '3000' },
        fields: [{ key: 'minUsdc', label: 'Min USDC', type: 'number', placeholder: '100' }],
        position: { x: SECTION_COLUMNS.conditions, y: 300 },
      },
      {
        id: 'tmpl-ct-cond-3',
        nodeType: 'blockNode',
        type: 'no_recent_bet',
        label: 'No Recent Bet',
        section: 'conditions',
        color: SECTION_COLORS_STATIC.conditions,
        config: { windowMs: '7200000' },
        fields: [{ key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '300000' }],
        position: { x: SECTION_COLUMNS.conditions, y: 500 },
      },
      {
        id: 'tmpl-ct-action-1',
        nodeType: 'blockNode',
        type: 'buy_no',
        label: 'Buy NO',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { marketSlot: '$MARKET_A', size: '50' },
        fields: [
          { key: 'marketSlot', label: 'Market', type: 'market_slot', placeholder: '$MARKET_A' },
          { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' },
        ],
        position: { x: SECTION_COLUMNS.actions, y: 100 },
      },
      {
        id: 'tmpl-ct-action-2',
        nodeType: 'blockNode',
        type: 'set_stop_loss',
        label: 'Set Stop Loss',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '10' },
        fields: [{ key: 'pct', label: 'Stop Loss (%)', type: 'number', placeholder: '10' }],
        position: { x: SECTION_COLUMNS.actions, y: 300 },
      },
      {
        id: 'tmpl-ct-action-3',
        nodeType: 'blockNode',
        type: 'set_take_profit',
        label: 'Set Take Profit',
        section: 'actions',
        color: SECTION_COLORS_STATIC.actions,
        config: { pct: '40' },
        fields: [{ key: 'pct', label: 'Take Profit (%)', type: 'number', placeholder: '20' }],
        position: { x: SECTION_COLUMNS.actions, y: 500 },
      },
    ],
    edges: [
      { id: 'tmpl-ct-e1', source: 'tmpl-ct-trigger-1', target: 'tmpl-ct-logic-1' },
      { id: 'tmpl-ct-e2', source: 'tmpl-ct-trigger-2', target: 'tmpl-ct-logic-1' },
      { id: 'tmpl-ct-e3', source: 'tmpl-ct-logic-1', target: 'tmpl-ct-cond-1' },
      { id: 'tmpl-ct-e4', source: 'tmpl-ct-cond-1', target: 'tmpl-ct-cond-2' },
      { id: 'tmpl-ct-e5', source: 'tmpl-ct-cond-2', target: 'tmpl-ct-cond-3' },
      { id: 'tmpl-ct-e6', source: 'tmpl-ct-cond-3', target: 'tmpl-ct-action-1' },
      { id: 'tmpl-ct-e7', source: 'tmpl-ct-action-1', target: 'tmpl-ct-action-2' },
      { id: 'tmpl-ct-e8', source: 'tmpl-ct-action-2', target: 'tmpl-ct-action-3' },
    ],
  },
];

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
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
          className={`inline-block size-2 rounded-full ${
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
      <span className={`ml-1 text-caption capitalize ${
        difficulty === 'beginner' ? 'text-gain' :
        difficulty === 'intermediate' ? 'text-warning' :
        'text-loss'
      }`}>{difficulty}</span>
    </span>
  );
}

const TEMPLATE_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  momentum: <TrendingUp className="size-3" />,
  'mean-reversion': <RefreshCw className="size-3" />,
  'event-based': <Calendar className="size-3" />,
  sentiment: <Brain className="size-3" />,
};

// ─── Canvas Search ──────────────────────────────────────────────────────────

interface CanvasSearchBarProps {
  open: boolean;
  onClose: () => void;
}

function CanvasSearchBar({ open, onClose }: CanvasSearchBarProps) {
  const [query, setQuery] = useState('');
  const nodes = useBuilderStore((s) => s.nodes);
  const setHighlightedBlockId = useBuilderStore((s) => s.setHighlightedBlockId);
  const { fitView } = useReactFlow();

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes.filter((n) => {
      const data = n.data as Record<string, unknown>;
      const label = String(data.label ?? '').toLowerCase();
      const type = String(data.type ?? '').toLowerCase();
      const section = String(data.section ?? '').toLowerCase();
      return label.includes(q) || type.includes(q) || section.includes(q);
    });
  }, [nodes, query]);

  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    setMatchIndex(0);
  }, [query]);

  const navigateToMatch = useCallback((index: number) => {
    const node = matches[index];
    if (!node) return;
    setHighlightedBlockId(node.id);
    fitView({ nodes: [{ id: node.id }], duration: 300, padding: 0.5 });
    const timer = setTimeout(() => setHighlightedBlockId(null), 3000);
    return () => clearTimeout(timer);
  }, [matches, setHighlightedBlockId, fitView]);

  useEffect(() => {
    if (matches.length > 0) {
      navigateToMatch(matchIndex);
    } else {
      setHighlightedBlockId(null);
    }
  }, [matchIndex, matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setHighlightedBlockId(null);
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        setMatchIndex((i) => (i - 1 + matches.length) % matches.length);
      } else {
        setMatchIndex((i) => (i + 1) % matches.length);
      }
    }
  }, [onClose, setHighlightedBlockId, matches.length]);

  if (!open) return null;

  return (
    <div className="absolute top-2 right-2 z-30 flex items-center gap-2 bg-elevated border border-default rounded-pf shadow-elevation-2 px-3 py-2">
      <Search className="size-4 text-tertiary shrink-0" />
      <input
        type="text"
        placeholder="Search canvas blocks..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        aria-label="Search blocks on canvas"
        className="w-48 bg-transparent text-body-sm text-primary placeholder:text-tertiary focus-visible:outline-none"
      />
      {query && matches.length > 0 && (
        <span className="text-caption text-tertiary whitespace-nowrap">
          {matchIndex + 1}/{matches.length}
        </span>
      )}
      {query && matches.length === 0 && (
        <span className="text-caption text-tertiary">No match</span>
      )}
      <button
        type="button"
        onClick={() => { setHighlightedBlockId(null); onClose(); }}
        aria-label="Close search"
        className="p-0.5 rounded-sm hover:bg-overlay text-tertiary hover:text-primary transition-colors"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Component() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [panelOpen, setPanelOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const { usage: betaUsage } = useBetaUsage();

  // Execution panel state
  const [execPanelExpanded, setExecPanelExpanded] = useState(false);
  const [execTab, setExecTab] = useState<'backtest' | 'live'>('backtest');
  const [showTutorial, setShowTutorial] = useState(false);

  const name = useBuilderStore((s) => s.name);
  const setName = useBuilderStore((s) => s.setName);
  const saving = useBuilderStore((s) => s.saving);
  const loading = useBuilderStore((s) => s.loading);
  const strategyId = useBuilderStore((s) => s.strategyId);
  const loadStrategy = useBuilderStore((s) => s.loadStrategy);
  const save = useBuilderStore((s) => s.save);
  const reset = useBuilderStore((s) => s.reset);

  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const historyLength = useBuilderStore((s) => s._history.length);
  const futureLength = useBuilderStore((s) => s._future.length);

  const marketId = useBuilderStore((s) => s.marketId);
  const setMarketId = useBuilderStore((s) => s.setMarketId);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketResults, setMarketResults] = useState<Array<{id: string; title: string; category: string}>>([]);
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [pinnedMarket, setPinnedMarket] = useState<{id: string; title: string} | null>(null);

  const [quickTesting, setQuickTesting] = useState(false);
  const [quickResult, setQuickResult] = useState<Record<string, unknown> | null>(null);

  // Template library state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [confirmTemplate, setConfirmTemplate] = useState<StrategyTemplate | null>(null);

  // Canvas search state
  const [canvasSearch, setCanvasSearch] = useState('');
  const [canvasSearchOpen, setCanvasSearchOpen] = useState(false);
  const setHighlightedBlockId = useBuilderStore((s) => s.setHighlightedBlockId);
  const allNodes = useBuilderStore((s) => s.nodes);

  const setNodes = useBuilderStore((s) => s.setNodes);
  const setEdges = useBuilderStore((s) => s.setEdges);

  const isEdit = !!id;
  const isNewStrategy = !isEdit;

  const [wizardStep, setWizardStep] = useState<'template' | 'builder'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const TEMPLATES = [
    {
      id: 'momentum',
      name: 'Simple Momentum',
      description: 'Buys YES when price crosses above a threshold. Best for trending markets.',
      icon: '📈',
      trigger: 'Event',
      difficulty: 'Beginner',
    },
    {
      id: 'mean-reversion',
      name: 'Mean Reversion',
      description: 'Buys when price dips below the recent average. Profits from temporary overselling.',
      icon: '↩️',
      trigger: 'Tick',
      difficulty: 'Beginner',
    },
    {
      id: 'news-reactive',
      name: 'News Reactive',
      description: 'Trades on AI-detected high-confidence news signals.',
      icon: '📰',
      trigger: 'Event',
      difficulty: 'Intermediate',
    },
    {
      id: 'whale-follower',
      name: 'Whale Follower',
      description: 'Copies whale trades with configurable size and risk filters.',
      icon: '🐋',
      trigger: 'Event',
      difficulty: 'Intermediate',
    },
    {
      id: 'blank',
      name: 'Start from Scratch',
      description: 'Open the strategy builder with a blank canvas.',
      icon: '⬜',
      trigger: null,
      difficulty: 'Advanced',
    },
  ] as const;

  // Detect action blocks whose configured size exceeds the beta position-size limit.
  const positionSizeViolations = useBuilderStore((s) => {
    const maxSize = betaUsage?.positionSize.maxUsdc ?? Infinity;
    return s.nodes.filter((n) => {
      if (n.type !== 'blockNode') return false;
      const nd = n.data as import('../../stores/builder-store').BlockNodeData;
      if (nd.section !== 'actions') return false;
      const sizeVal = parseFloat(String(nd.config['size'] ?? ''));
      return !isNaN(sizeVal) && sizeVal > maxSize;
    }).length;
  });

  // Count canvas issues: unwired trigger/action blocks + active blocks with empty required fields.
  const canvasIssueSummary = useBuilderStore((s) => {
    const connectedIds = new Set<string>([
      ...s.edges.map((e) => e.source),
      ...s.edges.map((e) => e.target),
    ]);
    let orphaned = 0;
    let misconfigured = 0;
    for (const n of s.nodes) {
      if (n.type !== 'blockNode') continue;
      const nd = n.data as import('../../stores/builder-store').BlockNodeData;
      const isOrphaned = (nd.section === 'triggers' || nd.section === 'actions') && !connectedIds.has(n.id);
      if (isOrphaned) { orphaned++; continue; }
      // For active (non-orphaned) blocks, check for empty required fields
      const hasEmpty = nd.fields.some((f) => !(nd.config[f.key] ?? ''));
      if (hasEmpty) misconfigured++;
    }
    return `${orphaned}:${misconfigured}`;
  });
  const canvasIssues = useMemo(() => {
    const [orphaned = 0, misconfigured = 0] = canvasIssueSummary
      .split(':')
      .map((value) => Number.parseInt(value, 10) || 0);
    return { orphaned, misconfigured };
  }, [canvasIssueSummary]);

  // Load or reset on mount
  useEffect(() => {
    if (id) {
      loadStrategy(id).catch(() => {
        toast.error('Failed to load strategy');
        navigate('/strategies');
      });
    } else {
      reset();
      capture('strategy_form_opened');
    }

    // Cleanup on unmount
    return () => {
      reset();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn on unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useBuilderStore.getState().dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!marketSearch.trim() || marketSearch.length < 2) { setMarketResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/v1/markets?search=${encodeURIComponent(marketSearch)}&limit=8`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setMarketResults(d?.data ?? []))
        .catch(() => { /* typeahead search — don't toast transient failures */ });
    }, 300);
    return () => clearTimeout(t);
  }, [marketSearch]);

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (mod && e.key === 'f') { e.preventDefault(); setCanvasSearchOpen(true); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!marketId) { setPinnedMarket(null); return; }
    fetch(`/api/v1/markets/${marketId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPinnedMarket({ id: d.id, title: d.title }); })
      .catch(() => { /* typeahead search — don't toast transient failures */ });
  }, [marketId]);

  const onSave = useCallback(async () => {
    try {
      const result = await save();
      toast.success(isEdit ? 'Strategy saved' : 'Strategy created');
      const savedId = (result as Record<string, unknown>)?.id ?? strategyId;
      if (savedId) {
        navigate(`/strategies/${savedId}`);
      } else {
        navigate('/strategies');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      if (message === 'SESSION_EXPIRED') {
        toast.error('Session expired — your work is preserved', {
          description: 'Log in again to save your strategy.',
          duration: Infinity,
          action: { label: 'Log in', onClick: () => { window.location.href = '/login'; } },
        });
      } else {
        toast.error(message, { duration: 6000 });
      }
    }
  }, [save, isEdit, strategyId, navigate]);

  const onQuickTest = useCallback(async () => {
    if (!strategyId) {
      toast.error('Save the strategy first to run a quick test');
      return;
    }
    setQuickTesting(true);
    setQuickResult(null);
    try {
      const res = await fetch('/api/v1/backtests/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategyId, quickMode: true }),
      });
      if (res.ok) {
        const result = await res.json();
        setQuickResult(result);
        toast.success('Quick test complete');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Quick test failed');
      }
    } catch {
      toast.error('Quick test failed');
    }
    setQuickTesting(false);
  }, [strategyId]);

  const loadTemplate = useCallback((template: StrategyTemplate) => {
    const newNodes: Node<BlockNodeData>[] = template.blocks.map((b) => ({
      id: b.id,
      type: b.nodeType,
      position: b.position,
      data: {
        type: b.type,
        label: b.label,
        section: b.section,
        color: b.color,
        config: b.config,
        fields: b.fields,
      } as BlockNodeData,
    }));
    const newEdges: Edge[] = template.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      type: 'smoothstep',
      animated: true,
    }));
    setNodes(newNodes);
    setEdges(newEdges);
    setConfirmTemplate(null);
    setShowTemplates(false);
    toast.success('Template loaded! Customize it to fit your strategy.');
  }, [setNodes, setEdges]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.polyforge') && !file.name.endsWith('.json')) {
      toast.error('Please drop a .polyforge or .json file');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.strategy?.name) {
        toast.error('Invalid strategy file format');
        return;
      }

      const userAccepted = await new Promise<boolean>((resolve) => {
        const msg = `Load strategy "${data.strategy.name}"? This will replace the current blocks.`;
        // Use toast with action for non-blocking confirm
        toast(msg, {
          action: { label: 'Load', onClick: () => resolve(true) },
          cancel: { label: 'Cancel', onClick: () => resolve(false) },
          onDismiss: () => resolve(false),
          duration: 15000,
        });
      });
      if (!userAccepted) return;

      const res = await fetch('/api/v1/strategies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Failed to import strategy');
        return;
      }

      const created = await res.json();
      toast.success('Strategy imported successfully');
      navigate(`/strategies/${created.id}/edit`);
    } catch {
      toast.error('Invalid strategy file');
    }
  }, [navigate]);

  // ─── Template wizard (new strategy only) ─────────────────────────────

  if (wizardStep === 'template' && isNewStrategy) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-xl font-semibold text-primary mb-1">New Strategy</h1>
        <p className="text-body-sm text-secondary mb-6">Choose a starting point</p>
        <div className="grid grid-cols-1 gap-3">
          {TEMPLATES.map(t => (
            <Button
              key={t.id}
              type="button"
              variant="ghost"
              onClick={async () => {
                if (t.id !== 'blank') {
                  // Load from template
                  const r = await fetch(`/api/v1/strategies/templates`, { credentials: 'include' });
                  // Find matching template and pre-fill
                }
                setSelectedTemplate(t.id);
                setWizardStep('builder');
              }}
              className="flex items-center gap-4 p-4 text-left group w-full justify-start"
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-body-md font-semibold text-primary group-hover:text-accent-text transition-colors">{t.name}</span>
                  {t.trigger && (
                    <span className="text-caption px-2 py-1 rounded-sm bg-surface-elevated border border-default text-tertiary">{t.trigger}</span>
                  )}
                  <span className={`text-caption px-2 py-1 rounded-sm border ${
                    t.difficulty === 'Beginner' ? 'bg-gain/10 border-gain/30 text-gain' :
                    t.difficulty === 'Intermediate' ? 'bg-warning/10 border-warning/30 text-warning' :
                    'bg-loss/10 border-loss/30 text-loss'
                  }`}>{t.difficulty}</span>
                </div>
                <p className="text-label text-tertiary mt-1">{t.description}</p>
              </div>
              <ChevronRight size={16} className="text-tertiary group-hover:text-accent-text flex-shrink-0 transition-colors" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle bg-elevated/50 shrink-0">
        <Link
          to="/strategies"
          className="flex items-center gap-2 text-label text-secondary hover:text-primary focus-visible:outline-none focus-visible:shadow-focus-ring rounded-sm transition-colors"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Strategies
        </Link>

        <div className="w-px h-4 bg-subtle" />

        {editingName ? (
          <Input
            aria-label="Strategy name"
            className="flex-1 min-w-0 bg-transparent border-b border-accent rounded-none text-lg font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
            autoFocus
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditingName(true)}
            aria-label={`Edit strategy name: ${name || 'Untitled Strategy'}`}
            className="group flex items-center gap-2 truncate flex-1 text-left justify-start text-lg font-semibold p-0"
          >
            <h1 className="text-lg font-semibold truncate">{name || 'Untitled Strategy'}</h1>
            <Pencil size={14} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" aria-hidden="true" />
          </Button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {/* Panel toggle */}
          <Button
            type="button"
            variant={panelOpen ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setPanelOpen((v) => !v)}
            aria-label={panelOpen ? 'Hide blocks panel' : 'Show blocks panel'}
            title={panelOpen ? 'Hide blocks' : 'Show blocks'}
          >
            <Blocks className="size-4" />
          </Button>

          {/* Execution panel toggle */}
          <Button
            type="button"
            variant={execPanelExpanded ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => { setExecPanelExpanded((v) => !v); }}
            aria-label={execPanelExpanded ? 'Collapse execution panel' : 'Expand execution panel'}
            title={execPanelExpanded ? 'Collapse execution panel' : 'Backtest & Live'}
          >
            <FlaskConical className="size-4" />
          </Button>

          {/* Tutorial help */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowTutorial(true)}
            aria-label="Show builder tutorial"
            title="How the builder works"
          >
            <HelpCircle className="size-4" />
          </Button>

          {/* Canvas search */}
          <Button
            type="button"
            variant={canvasSearchOpen ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setCanvasSearchOpen((v) => !v)}
            aria-label="Search blocks on canvas"
            title="Search Canvas (Ctrl+F)"
          >
            <Search className="size-4" />
          </Button>

          {/* Template library */}
          <Button
            type="button"
            variant={showTemplates ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => { setShowTemplates(true); setTemplateCategory('all'); }}
            aria-label="Open template library"
            title="Strategy Templates"
          >
            <LayoutTemplate className="size-4" />
          </Button>

          <div className="w-px h-4 bg-subtle" />

          {/* Undo */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={historyLength === 0}
            aria-label={`Undo (${historyLength} step${historyLength !== 1 ? 's' : ''})`}
            title={`Undo (Ctrl+Z) — ${historyLength} step${historyLength !== 1 ? 's' : ''}`}
          >
            <RotateCcw className="size-4" />
          </Button>

          {/* Redo */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={futureLength === 0}
            aria-label={`Redo (${futureLength} step${futureLength !== 1 ? 's' : ''})`}
            title={`Redo (Ctrl+Y) — ${futureLength} step${futureLength !== 1 ? 's' : ''}`}
          >
            <RotateCw className="size-4" />
          </Button>

          <div className="w-px h-4 bg-subtle" />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onQuickTest}
            disabled={loading || quickTesting || !strategyId}
            title="Run a 7-day quick backtest"
            className="flex items-center gap-2"
          >
            {quickTesting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Zap className="size-3" />
            )}
            Quick Test
          </Button>

          <Link
            to="/strategies"
            className="px-3 py-2 text-label text-secondary hover:text-primary rounded-sm hover:bg-overlay transition-colors"
          >
            Cancel
          </Link>

          {positionSizeViolations > 0 && (
            <span
              className="flex items-center gap-1 text-xs text-[var(--color-gold-500)]"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
              {positionSizeViolations} action block{positionSizeViolations !== 1 ? 's' : ''} exceed${positionSizeViolations === 1 ? 's' : ''} the ${betaUsage?.positionSize.maxUsdc ?? 500} USDC beta limit
            </span>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={loading || saving || positionSizeViolations > 0}
            className="flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            {isEdit ? 'Save Changes' : 'Create Strategy'}
          </Button>
        </div>
      </div>

      {/* ─── Template Library Panel ─────────────────────────────────────── */}
      {showTemplates && (
        <div
          className="absolute inset-0 z-50 flex flex-col bg-surface/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Strategy Template Library"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-default bg-elevated shrink-0">
            <div>
              <h2 className="text-base font-semibold text-primary flex items-center gap-2">
                <LayoutTemplate className="size-4 text-accent-text" aria-hidden="true" />
                Strategy Templates
              </h2>
              <p className="text-label text-tertiary mt-1">Start faster with a pre-built strategy</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => { setShowTemplates(false); setConfirmTemplate(null); }}
              aria-label="Close template library"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Category filter tabs */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-subtle bg-elevated/50 shrink-0 overflow-x-auto">
            {(['all', 'momentum', 'mean-reversion', 'event-based', 'sentiment'] as const).map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={templateCategory === cat ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTemplateCategory(cat)}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                {cat !== 'all' && (
                  <span aria-hidden="true" className="opacity-70">{TEMPLATE_CATEGORY_ICONS[cat]}</span>
                )}
                {TEMPLATE_CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>

          {/* Template cards grid */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {STRATEGY_TEMPLATES
                .filter((t) => templateCategory === 'all' || t.category === templateCategory)
                .map((template) => (
                  <div
                    key={template.id}
                    className="flex flex-col bg-elevated border border-default rounded-pf p-4 hover:border-strong transition-colors"
                  >
                    {/* Card header */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl leading-none mt-1 shrink-0" aria-hidden="true">{template.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-body-md font-semibold text-primary truncate">{template.name}</h3>
                        <DifficultyDots difficulty={template.difficulty} />
                      </div>
                    </div>

                    {/* Win rate badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface border border-default text-caption text-tertiary">
                        <Zap className="size-3 text-warning" aria-hidden="true" />
                        Win rate: {template.estimatedWinRate}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface border border-default text-caption text-tertiary capitalize">
                        {TEMPLATE_CATEGORY_ICONS[template.category]}
                        <span>{TEMPLATE_CATEGORY_LABELS[template.category]}</span>
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-label text-tertiary leading-relaxed flex-1 mb-4">{template.description}</p>

                    {/* Block count summary */}
                    <div className="text-caption text-tertiary mb-3">
                      {template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''} &middot; {template.edges.length} connection{template.edges.length !== 1 ? 's' : ''}
                    </div>

                    {/* Confirmation inline or use button */}
                    {confirmTemplate?.id === template.id ? (
                      <div className="bg-warning-subtle border border-warning/25 rounded-pf p-3">
                        <p className="text-label text-warning mb-2 font-medium">This will replace your current canvas. Continue?</p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmTemplate(null)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => loadTemplate(template)}
                            className="flex-1"
                          >
                            Load Template
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmTemplate(template)}
                        className="w-full"
                      >
                        Use Template
                      </Button>
                    )}
                  </div>
                ))}
            </div>

            {/* Empty state */}
            {STRATEGY_TEMPLATES.filter((t) => templateCategory === 'all' || t.category === templateCategory).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <LayoutTemplate className="size-8 text-tertiary mb-3 opacity-40" />
                <p className="text-body-sm text-tertiary">No templates in this category yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Canvas + Panel ─────────────────────────────────────────────── */}
      <ReactFlowProvider>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Canvas */}
            <div
              className="flex-1 relative min-w-0 isolate"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Canvas issue banner — unwired blocks and/or misconfigured fields */}
              {(canvasIssues.orphaned > 0 || canvasIssues.misconfigured > 0) && (
                <div
                  className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3 py-2 rounded-full text-label font-medium pointer-events-none border ${
                    canvasIssues.misconfigured > 0
                      ? 'bg-loss/10 border-loss/25 text-loss'
                      : 'bg-warning/10 border-warning/25 text-warning'
                  }`}
                  role="status"
                >
                  {canvasIssues.orphaned > 0 && (
                    <span>
                      {canvasIssues.orphaned} block{canvasIssues.orphaned !== 1 ? 's' : ''} not wired
                    </span>
                  )}
                  {canvasIssues.orphaned > 0 && canvasIssues.misconfigured > 0 && (
                    <span className="opacity-40">·</span>
                  )}
                  {canvasIssues.misconfigured > 0 && (
                    <span>
                      {canvasIssues.misconfigured} block{canvasIssues.misconfigured !== 1 ? 's' : ''} need{canvasIssues.misconfigured === 1 ? 's' : ''} setup
                    </span>
                  )}
                </div>
              )}
              <StrategyCanvas />
              {loading && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-surface/80 backdrop-blur-sm pointer-events-none">
                  <div className="flex flex-col items-center gap-3 text-tertiary">
                    <Loader2 className="size-6 animate-spin" />
                    <span className="text-body-sm">Loading strategy...</span>
                  </div>
                </div>
              )}
              <CanvasSearchBar open={canvasSearchOpen} onClose={() => setCanvasSearchOpen(false)} />
              <BuilderTutorial forceVisible={showTutorial} onDismiss={() => setShowTutorial(false)} />
              {dragOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm border-2 border-dashed border-accent rounded-pf pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-accent-text">
                    <Upload className="size-8" />
                    <span className="text-body-md font-medium">Drop .polyforge file to import</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick test results overlay */}
            {quickResult && (
              <div className="absolute bottom-4 left-4 z-40 bg-elevated border border-default rounded-pf p-4 shadow-elevation-2 max-w-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label font-semibold text-primary uppercase tracking-wider">Quick Test Results</span>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setQuickResult(null)} aria-label="Close quick test results"><X className="size-3" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-label">
                  <div className="bg-surface rounded-pf p-2">
                    <span className="text-secondary block">P&L</span>
                    <span className={`font-mono tabular-nums font-semibold ${parseFloat(String(quickResult.totalPnl ?? '0')) >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {parseFloat(String(quickResult.totalPnl ?? '0')) >= 0 ? '+' : ''}{String(quickResult.totalPnl)}
                    </span>
                  </div>
                  <div className="bg-surface rounded-pf p-2">
                    <span className="text-secondary block">Win Rate</span>
                    <span className="font-mono tabular-nums font-semibold text-primary">{String(quickResult.winRate)}%</span>
                  </div>
                  <div className="bg-surface rounded-pf p-2">
                    <span className="text-secondary block">Orders</span>
                    <span className="font-mono tabular-nums font-semibold text-primary">{String(quickResult.totalOrders)}</span>
                  </div>
                  <div className="bg-surface rounded-pf p-2">
                    <span className="text-secondary block">Filled</span>
                    <span className="font-mono tabular-nums font-semibold text-primary">{String(quickResult.filledOrders)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Side panel — always mounted, collapsed via width to prevent React Flow reflow issues */}
            <div className={`transition-all duration-panel overflow-hidden ${panelOpen ? 'w-80' : 'w-0'}`}>
              <BlockPalette open={panelOpen} onClose={() => setPanelOpen(false)} />
              {/* Market Picker */}
              <div className="border-t border-default mt-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMarketPickerOpen(p => !p)}
                  className="w-full flex items-center gap-2 justify-start"
                >
                  <Target className="size-4 text-accent-text" aria-hidden="true" />
                  Pinned Market
                  {pinnedMarket && <span className="ml-auto text-caption bg-accent-subtle text-accent-text px-2 py-1 rounded-full truncate max-w-24">{pinnedMarket.title.slice(0, 20)}{pinnedMarket.title.length > 20 ? '…' : ''}</span>}
                </Button>
                {marketPickerOpen && (
                  <div className="px-2 pb-2 space-y-2">
                    {pinnedMarket ? (
                      <div className="flex items-center gap-2 bg-elevated border border-accent/25 rounded-pf p-2">
                        <span className="text-label text-primary flex-1 truncate">{pinnedMarket.title}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setMarketId(''); setPinnedMarket(null); }}
                          aria-label="Unpin market"
                          title="Unpin market"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          type="text"
                          placeholder="Search markets…"
                          value={marketSearch}
                          onChange={e => setMarketSearch(e.target.value)}
                          className="w-full"
                        />
                        {marketResults.length > 0 && (
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {marketResults.map(m => (
                              <Button
                                key={m.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { setMarketId(m.id); setPinnedMarket({ id: m.id, title: m.title }); setMarketSearch(''); setMarketResults([]); }}
                                className="w-full text-left justify-start truncate"
                              >
                                {m.title}
                              </Button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Execution Panel (bottom) ─────────────────────────────────── */}
          <ExecutionPanel
            strategyId={strategyId}
            expanded={execPanelExpanded}
            onToggle={() => setExecPanelExpanded((v) => !v)}
            activeTab={execTab}
            onTabChange={setExecTab}
          />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
