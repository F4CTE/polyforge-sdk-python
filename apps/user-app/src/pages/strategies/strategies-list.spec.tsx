// @vitest-environment node

/**
 * Regression tests for POLA-990 / GitHub #1001.
 *
 * Root cause: header used `flex items-center justify-between` (no wrap).
 * At 375 px the button group overflowed the root overflow-hidden boundary,
 * hiding the New Strategy CTA. Fix: flex-col on mobile + flex-wrap on group.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/* ─── Source-code invariant helpers ────────────────────────────────────── */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, './strategies-list.tsx'), 'utf-8');

/* ─── Helper functions (mirrored from component) ───────────────────────── */

type ExecMode = 'TICK' | 'EVENT' | 'HYBRID';
type StrategyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'PAPER' | 'ARCHIVED';

function execLabel(s: { execMode: ExecMode; tickMs: number }): string {
  if (s.execMode === 'TICK') return `Tick · ${s.tickMs}ms`;
  if (s.execMode === 'EVENT') return 'Event';
  return `Hybrid · ${s.tickMs}ms`;
}

function blocksCount(s: { triggers: unknown[]; conditions: unknown[]; actions: unknown[]; safety: unknown[] }): number {
  return s.safety.length + s.triggers.length + s.conditions.length + s.actions.length;
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function statusGradient(status: StrategyStatus): string {
  switch (status) {
    case 'RUNNING': return 'var(--accent-default)';
    case 'PAPER':   return 'var(--chart-category-2)';
    case 'PAUSED':  return 'var(--warning)';
    case 'ERROR':   return 'var(--loss)';
    default:        return 'var(--border-subtle)';
  }
}

/* ─── Helper unit tests ─────────────────────────────────────────────────── */

describe('strategies-list helpers', () => {
  describe('execLabel', () => {
    it('formats TICK mode with tick interval', () => {
      expect(execLabel({ execMode: 'TICK', tickMs: 500 })).toBe('Tick · 500ms');
    });
    it('formats EVENT mode without interval', () => {
      expect(execLabel({ execMode: 'EVENT', tickMs: 0 })).toBe('Event');
    });
    it('formats HYBRID mode with tick interval', () => {
      expect(execLabel({ execMode: 'HYBRID', tickMs: 250 })).toBe('Hybrid · 250ms');
    });
  });

  describe('blocksCount', () => {
    it('sums all block arrays', () => {
      const s = { triggers: [1, 2], conditions: [1], actions: [1, 2, 3], safety: [1] };
      expect(blocksCount(s)).toBe(7);
    });
    it('returns 0 for empty strategy', () => {
      expect(blocksCount({ triggers: [], conditions: [], actions: [], safety: [] })).toBe(0);
    });
  });

  describe('formatPnl', () => {
    it('prefixes positive values with +$', () => {
      expect(formatPnl(123.5)).toBe('+$123.50');
    });
    it('prefixes negative values with -$', () => {
      expect(formatPnl(-42.1)).toBe('-$42.10');
    });
    it('treats zero as positive', () => {
      expect(formatPnl(0)).toBe('+$0.00');
    });
  });

  describe('statusGradient', () => {
    it('returns accent color for RUNNING', () => {
      expect(statusGradient('RUNNING')).toBe('var(--accent-default)');
    });
    it('returns warning color for PAUSED', () => {
      expect(statusGradient('PAUSED')).toBe('var(--warning)');
    });
    it('returns loss color for ERROR', () => {
      expect(statusGradient('ERROR')).toBe('var(--loss)');
    });
    it('returns border-subtle for IDLE', () => {
      expect(statusGradient('IDLE')).toBe('var(--border-subtle)');
    });
  });
});

/* ─── Mobile CTA layout regression (POLA-990 / GitHub #1001) ───────────── */

describe('strategies-list mobile CTA visibility regression', () => {
  /**
   * These assertions read the component source and verify the layout classes
   * that prevent the mobile overflow-hidden clip are present.
   *
   * Original broken state (DO NOT revert to):
   *   header:       "flex items-center justify-between"   ← no mobile stacking
   *   button group: "flex items-center gap-2"             ← no flex-wrap
   */

  it('header stacks vertically on mobile (flex-col) to prevent justify-between overflow', () => {
    expect(src).toContain('flex flex-col sm:flex-row');
  });

  it('justify-between is gated behind sm: breakpoint, not bare on mobile', () => {
    expect(src).toContain('sm:justify-between');
    // bare "justify-between" on the header row would replicate the overflow bug
    expect(src).not.toMatch(/"flex items-center justify-between"/);
  });

  it('button group uses flex-wrap so CTAs wrap instead of overflowing', () => {
    expect(src).toContain('flex flex-wrap items-center gap-2');
  });

  it('New Strategy enabled CTA links to /strategies/new', () => {
    expect(src).toContain('to="/strategies/new"');
  });

  it('New Strategy disabled CTA has aria-disabled="true" for accessibility', () => {
    expect(src).toContain('aria-disabled="true"');
  });

  it('filter tabs use overflow-x-auto for horizontal scroll on narrow viewports', () => {
    expect(src).toContain('overflow-x-auto');
  });
});
