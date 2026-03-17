import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

const svg = readFileSync(resolve(root, 'og-image.svg'));

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: false },  // keep reproducible — system fonts not needed for SVG-defined text
});

const png = resvg.render().asPng();
writeFileSync(resolve(root, 'og-image.png'), png);
console.log('✓  og-image.png written  (1200 × 630)');
