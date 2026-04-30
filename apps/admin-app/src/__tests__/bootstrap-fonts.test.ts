import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const html = readFileSync(htmlPath, 'utf8');

describe('admin app bootstrap fonts', () => {
  it('does not load Google-hosted Inter or JetBrains fonts before React starts', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toContain('family=Inter');
    expect(html).not.toContain('JetBrains+Mono');
  });

  it('uses the Geist stack for the pre-React loading text', () => {
    expect(html).toContain("font-family:'Geist','Geist Fallback',system-ui,sans-serif");
  });
});
