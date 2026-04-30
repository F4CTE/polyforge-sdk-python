/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const repoRoot = cwd.endsWith('apps/admin-app') ? resolve(cwd, '../..') : cwd;

const adminGlobals = readFileSync(resolve(repoRoot, 'apps/admin-app/src/globals.css'), 'utf8');
const sharedGlobals = readFileSync(resolve(repoRoot, 'packages/ui/src/globals.css'), 'utf8');
const designCharter = readFileSync(resolve(repoRoot, 'docs/13-design-charter.md'), 'utf8');

function sectionByHeading(markdown: string, heading: string) {
  const start = markdown.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextHeading = markdown.indexOf('\n## ', start + heading.length);
  return markdown.slice(start, nextHeading === -1 ? undefined : nextHeading);
}

function subsection(markdown: string, heading: string) {
  const start = markdown.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextHeading = markdown.indexOf('\n### ', start + heading.length);
  const nextTopHeading = markdown.indexOf('\n## ', start + heading.length);
  const ends = [nextHeading, nextTopHeading].filter((idx) => idx !== -1);
  const end = ends.length > 0 ? Math.min(...ends) : undefined;
  return markdown.slice(start, end);
}

describe('admin app accent tokens', () => {
  it('inherits the shared Electric Blue accent without admin-local redeclarations', () => {
    expect(adminGlobals).toContain('@import "@polyforge/ui/globals.css";');
    expect(adminGlobals).not.toMatch(/--accent-(default|hover|subtle|border|text)\s*:/);
    expect(adminGlobals).not.toMatch(/#8B5CF6|#A78BFA|#C4B5FD|139,\s*92,\s*246/i);

    expect(sharedGlobals).toContain('--accent-default: #4F6EF7;');
    expect(sharedGlobals).toContain('--accent-hover: #6B85F9;');
    expect(sharedGlobals).toContain('--accent-text: #7B96FF;');
  });

  it('documents Electric Blue inheritance for the admin panel', () => {
    const componentSection = sectionByHeading(designCharter, '## 16. Two-Layer Component System');
    const adminNotes = subsection(componentSection, '### Admin-specific notes');

    expect(adminNotes).toContain('inherits the shared PolyForge Electric Blue accent tokens');
    expect(adminNotes).toContain('must not redeclare app-level `--accent-*` tokens');
    expect(componentSection).not.toContain('#8B5CF6');
    expect(componentSection).not.toMatch(/Violet `#8B5CF6`/);
  });
});
