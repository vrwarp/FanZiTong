import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_ID__: JSON.stringify('testbuild'),
    __BUILD_TIME__: JSON.stringify('2026-09-05T00:00:00.000Z'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Pages, routing and PWA glue are exercised end-to-end by Playwright;
      // thresholds apply to the logic and component layers.
      include: [
        'src/lib/**',
        'src/db/**',
        'src/data/**',
        'src/state/**',
        'src/hooks/**',
        'src/components/**',
        'src/types/**',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'src/components/layout/**',
        // Socket and dialog glue; covered end to end by Playwright instead.
        'src/components/assistant/AssistantProvider.tsx',
        'src/components/assistant/AssistantPanel.tsx',
        'src/components/assistant/AssistantSettings.tsx',
        'src/lib/assistant/images.ts',
        'src/components/stats/**',
        'src/components/vocab/CardListItem.tsx',
        'src/hooks/useCards.ts',
        'src/hooks/useSettings.ts',
        'src/hooks/useNow.ts',
        'src/hooks/useStudyEngine.ts',
        'src/lib/io/download.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
