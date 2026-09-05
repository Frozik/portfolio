import { defineConfig } from 'vitest/config';

// One Vitest run, three environments: browser code under happy-dom, the Node
// server and the framework-free libs under plain Node. `--project <name>`
// scopes a run to one of them.
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'portfolio',
          environment: 'happy-dom',
          include: ['apps/portfolio/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          environment: 'happy-dom',
          include: ['libs/components/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'utils',
          environment: 'happy-dom',
          include: [
            'libs/utils/src/**/*.{test,spec}.ts',
            'libs/communication-protocol/src/**/*.{test,spec}.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'communication',
          environment: 'node',
          include: ['apps/communication/src/**/*.{test,spec}.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}', 'libs/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', '**/*.test-helper*', '**/translations/**'],
      reporter: ['text', 'html'],
    },
  },
});
