/**
 * Gera os ícones PNG do PWA (escudo azul + check de "aprovado").
 * Uso: npm run icons   (requer Playwright com Chromium)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'public');

const svg = ({ size, rounded, scale }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#1E3A8A"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <path d="M256 96 L392 144 V240 C392 328 332 388 256 416 C180 388 120 328 120 240 V144 Z" fill="#fff" opacity=".14"/>
    <path d="M188 260 L236 308 L332 200" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const targets = [
  { file: 'pwa-192x192.png', size: 192, rounded: true, scale: 1 },
  { file: 'pwa-512x512.png', size: 512, rounded: true, scale: 1 },
  { file: 'maskable-512x512.png', size: 512, rounded: false, scale: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.9 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(t)}</body></html>`);
  const buffer = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(path.join(out, t.file), buffer);
  console.log('✓', t.file);
}
await browser.close();
