import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Base path is configurable so the same build can be hosted at the domain root
// or under a sub-path (e.g. GitHub Pages: VITE_BASE_PATH=/FanZiTong/).
const base = process.env.VITE_BASE_PATH ?? '/';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * A short identity for this exact build. The package version is the same across
 * every deploy, so it cannot answer "is my copy current?" — the commit does.
 * CI exposes the commit as GITHUB_SHA; a local build reads git; neither is fatal.
 */
function resolveBuildId(): string {
  const fromEnv = process.env.VITE_BUILD_ID ?? process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(resolveBuildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: base,
        name: '繁字通 FanZiTong',
        short_name: '繁字通',
        description:
          'Traditional Chinese reading acquisition for heritage learners: FSRS spaced repetition, cloze, Taiwanese menu realia and visual foil drills. Works fully offline.',
        lang: 'zh-Hant-TW',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fdf8f2',
        theme_color: '#c1272d',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything the app needs to run is precached (CacheFirst semantics),
        // so the whole study session works with zero network access.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          data: ['dexie', 'dexie-react-hooks', 'ts-fsrs', 'zod', 'papaparse'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
