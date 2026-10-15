import { defineConfig } from 'vitest/config';

// One Vitest run, three environments: browser code under happy-dom, the Node
// server and the framework-free libs under plain Node. `--project <name>`
// scopes a run to one of them.
export default defineConfig({
  // Golden vault and SafeInCloud files are binary fixtures, imported as data URLs (`?inline`) so the same tests run in a browser.
  assetsInclude: ['**/*.pwv', '**/*.db'],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'portfolio',
          environment: 'happy-dom',
          include: [
            'apps/portfolio/src/**/*.{test,spec}.{ts,tsx}',
            'apps/portfolio/vite-plugins/**/*.{test,spec}.ts',
          ],
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
          name: 'table',
          environment: 'happy-dom',
          include: ['libs/table/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'bug-reporter',
          environment: 'happy-dom',
          include: ['libs/bug-reporter/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'charts',
          environment: 'happy-dom',
          include: ['libs/charts/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault-extension',
          environment: 'happy-dom',
          include: ['apps/vault-extension/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault-web',
          environment: 'happy-dom',
          include: [
            'apps/vault-web/src/**/*.{test,spec}.{ts,tsx}',
            'apps/vault-web/vite-plugins/**/*.{test,spec}.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault',
          environment: 'happy-dom',
          include: ['libs/vault/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault-browser',
          environment: 'happy-dom',
          include: ['libs/vault-browser/src/**/*.{test,spec}.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault-http',
          environment: 'node',
          include: ['libs/vault-http/src/**/*.{test,spec}.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault-react',
          environment: 'happy-dom',
          include: ['libs/vault-react/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'vault-app',
          environment: 'node',
          include: ['libs/vault-app/src/**/*.{test,spec}.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'cloud-storage',
          environment: 'happy-dom',
          include: ['libs/cloud-storage/src/**/*.{test,spec}.ts'],
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
          name: 'transport',
          environment: 'node',
          include: ['libs/transport/src/**/*.{test,spec}.ts'],
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
      {
        extends: true,
        test: {
          name: 'tooling',
          environment: 'node',
          include: [
            'libs/tooling/src/**/*.{test,spec}.ts',
            'libs/vite-plugins/src/**/*.{test,spec}.ts',
          ],
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
