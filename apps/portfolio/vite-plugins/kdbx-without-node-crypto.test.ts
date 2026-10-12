import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { build } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { kdbxWithoutNodeCrypto } from './kdbx-without-node-crypto.ts';

const KDBXWEB = createRequire(
  resolve(import.meta.dirname, '../../../libs/vault/package.json')
).resolve('kdbxweb');
const BUILD_TIMEOUT_MS = 60_000;

describe('kdbxWithoutNodeCrypto', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it(
    'bundles kdbxweb for the browser without externalizing Node’s crypto',
    async () => {
      // Vite reports an externalized Node built-in only in a production build.
      vi.stubEnv('NODE_ENV', 'production');
      const logs: string[] = [];
      await build({
        configFile: false,
        logLevel: 'silent',
        plugins: [kdbxWithoutNodeCrypto()],
        build: {
          write: false,
          lib: { entry: KDBXWEB, formats: ['es'], fileName: 'kdbx' },
          rolldownOptions: { onLog: (_level, log) => logs.push(log.message) },
        },
      });

      expect(logs.filter(message => message.includes('"crypto"'))).toEqual([]);
    },
    BUILD_TIMEOUT_MS
  );
});
