/**
 * Renders the PWA icons (PNG) from an inline HTML/CSS design using Playwright's
 * Chromium. Run with `npm run icons` whenever the brand mark changes; the
 * generated files are committed so builds stay hermetic.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/icons');

const FONT =
  "'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'WenQuanYi Zen Hei', 'Heiti TC', sans-serif";

function html({ size, maskable }) {
  const pad = maskable ? size * 0.2 : 0; // maskable safe zone = inner 80%
  const radius = maskable ? 0 : size * 0.22;
  const glyph = Math.round((size - pad * 2) * 0.66);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${size}px;height:${size}px;background:${maskable ? '#c1272d' : 'transparent'};}
    .tile{position:absolute;inset:0;background:#c1272d;border-radius:${radius}px;
      display:flex;align-items:center;justify-content:center;
      background-image:radial-gradient(circle at 30% 25%, rgba(255,255,255,.18), transparent 55%);}
    .glyph{font-family:${FONT};font-weight:700;font-size:${glyph}px;line-height:1;color:#fff8ec;
      text-shadow:0 ${size * 0.01}px ${size * 0.03}px rgba(0,0,0,.25);}
  </style></head><body><div class="tile"><span class="glyph" lang="zh-Hant-TW">繁</span></div></body></html>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon-180.png', size: 180, maskable: true },
];

const browser = await chromium.launch();
try {
  await mkdir(outDir, { recursive: true });
  for (const t of targets) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(html(t));
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ omitBackground: !t.maskable, type: 'png' });
    await writeFile(resolve(outDir, t.file), png);
    console.log(`wrote ${t.file} (${png.length} bytes)`);
    await page.close();
  }
} finally {
  await browser.close();
}
