import { describe, expect, it } from 'vitest';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        return collectSourceFiles(fullPath);
      }

      return /\.(tsx|jsx)$/.test(fullPath) ? [fullPath] : [];
    });
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function startsWithCaption(markup: string): boolean {
  return markup
    .replace(/^\s*{\/\*[\s\S]*?\*\/}/, '')
    .trimStart()
    .startsWith('<caption');
}

describe('data table accessible names', () => {
  it('keeps native table captions adjacent to table elements', () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(sourceRoot)) {
      const source = readFileSync(file, 'utf8');
      const tablePattern = /<table\b[^>]*>/g;
      let match: RegExpExecArray | null;

      while ((match = tablePattern.exec(source)) !== null) {
        if (!startsWithCaption(source.slice(tablePattern.lastIndex))) {
          violations.push(`${relative(sourceRoot, file)}:${lineNumber(source, match.index)}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('uses labelled hidden text instead of aria-label on role table layouts', () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(sourceRoot)) {
      const source = readFileSync(file, 'utf8');
      const roleTablePattern = /<div\b(?=[^>]*\brole=["']table["'])([^>]*)>/g;
      let match: RegExpExecArray | null;

      while ((match = roleTablePattern.exec(source)) !== null) {
        const attributes = match[1];
        if (/\baria-label=/.test(attributes) && !/\baria-labelledby=/.test(attributes)) {
          violations.push(`${relative(sourceRoot, file)}:${lineNumber(source, match.index)}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
