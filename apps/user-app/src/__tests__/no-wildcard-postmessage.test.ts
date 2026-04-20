import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, extname } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (EXTENSIONS.has(extname(entry.name)) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      results.push(full);
    }
  }
  return results;
}

describe('postMessage security', () => {
  it('never uses wildcard "*" as postMessage target origin', () => {
    const violations: string[] = [];
    const pattern = /\.postMessage\([^)]*,\s*['"](\*)['"]\s*\)/g;

    for (const file of collectFiles(ROOT)) {
      const content = readFileSync(file, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length;
        const relative = file.replace(ROOT + '/', '');
        violations.push(`${relative}:${line}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
