// @vitest-environment node
import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { describeStorageProviderContract } from '../testing/storage-contract';
import { probeWebDav } from './webdav-probe';
import { createWebDavProvider } from './webdav-provider';
import { createWebDavTransport } from './webdav-transport';

declare global {
  /** Vitest hands the process environment to the test as `import.meta.env`. */
  interface ImportMeta {
    readonly env: Readonly<Record<string, string | undefined>>;
  }
}

/** `scripts/webdav-contract.sh` starts `rclone serve webdav` in Docker and sets it; plain `pnpm test` skips. */
const SERVER = import.meta.env['WEBDAV_CONTRACT_URL'];

describe.skipIf(isNil(SERVER))('webdav against a real server', () => {
  describeStorageProviderContract('webdav, rclone serve webdav', async () => {
    assert(!isNil(SERVER));
    const server = new URL(SERVER);
    const account = {
      endpoint: new URL(`run-${crypto.randomUUID()}/`, server.origin).href,
      username: decodeURIComponent(server.username),
      password: decodeURIComponent(server.password),
    };
    const created = await fetch(account.endpoint, {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${btoa(`${account.username}:${account.password}`)}` },
    });
    assert(created.ok);
    const transport = createWebDavTransport(account);
    const features = await probeWebDav(transport, new AbortController().signal);
    assert(features.ok);
    return createWebDavProvider({ transport, features: features.value });
  });
});
