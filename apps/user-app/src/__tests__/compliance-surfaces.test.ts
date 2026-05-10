import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');

function source(path: string): string {
  return readFileSync(resolve(srcRoot, path), 'utf8');
}

describe('compliance user-facing surfaces', () => {
  it('settings exposes privacy data export controls backed by /api/v1/me/export', () => {
    const settings = source('pages/settings/settings.tsx');

    expect(settings).toContain("value: 'privacy'");
    expect(settings).toContain('/api/v1/me/export?format=');
    expect(settings).toContain('Download JSON');
    expect(settings).toContain('Download CSV');
  });

  it('leaderboard and copy discovery show past-performance risk disclaimers near P&L copy surfaces', () => {
    const leaderboard = source('pages/leaderboard/leaderboard.tsx');
    const copyDiscover = source('pages/copy/copy-discover.tsx');

    for (const page of [leaderboard, copyDiscover]) {
      expect(page).toContain('Past performance does not guarantee future results');
      expect(page).toContain('Trading on prediction markets involves risk of loss');
    }
  });
});
