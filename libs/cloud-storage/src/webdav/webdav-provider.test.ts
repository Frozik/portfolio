import type { Milliseconds } from '@frozik/utils/date/types';
import { Temporal } from 'temporal-polyfill';

import { storagePath } from '../core/storage-path';
import { describeStorageProviderContract } from '../testing/storage-contract';
import type { IFakeWebDavOptions } from './fake-webdav-server.test-helper';
import { createFakeWebDavServer, FAKE_ACCOUNT } from './fake-webdav-server.test-helper';
import type { IWebDavFeatures } from './webdav-features';
import { probeWebDav } from './webdav-probe';
import { createWebDavProvider } from './webdav-provider';
import { createWebDavTransport } from './webdav-transport';

const SIGNAL = new AbortController().signal;
const FILE = storagePath('Vault/main.pwv');
const LATER = Temporal.Instant.from('2026-10-20T10:00:00Z');

function providerOver(options: IFakeWebDavOptions, features: IWebDavFeatures) {
  const server = createFakeWebDavServer(options);
  const transport = createWebDavTransport(FAKE_ACCOUNT, server.fetch);
  const provider = createWebDavProvider({
    transport,
    features,
    now: () => LATER.epochMilliseconds as Milliseconds,
  });
  return { server, provider };
}

describeStorageProviderContract(
  'webdav, server-side compare-and-swap',
  () =>
    providerOver({}, { conditionalRequests: true, moveReplace: true, revisionKind: 'etag' })
      .provider
);

describeStorageProviderContract(
  'webdav, checked first and replaced by MOVE (rclone)',
  () =>
    providerOver(
      { conditionalRequests: false, corsAllowsConditions: false },
      { conditionalRequests: false, moveReplace: true, revisionKind: 'etag' }
    ).provider
);

describeStorageProviderContract(
  'webdav, plain PUT and modification times only',
  () =>
    providerOver(
      { conditionalRequests: false, moveReplace: false, etags: false },
      { conditionalRequests: false, moveReplace: false, revisionKind: 'last-modified' }
    ).provider
);

describe('webdav storage provider', () => {
  it('refuses a create the server already has, even when it does not honour If-None-Match', async () => {
    const { server, provider } = providerOver(
      { conditionalRequests: false },
      { conditionalRequests: false, moveReplace: true, revisionKind: 'etag' }
    );
    const created = await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
    server.putDirectly(FILE, Uint8Array.of(2));

    const raced = await provider.write(FILE, Uint8Array.of(3), { kind: 'overwrite' }, SIGNAL);
    const again = await provider.write(FILE, Uint8Array.of(4), { kind: 'absent' }, SIGNAL);

    expect(created.ok && created.value.kind).toBe('ok');
    expect(raced.ok && raced.value.kind).toBe('ok');
    expect(again.ok && again.value.kind).toBe('conflict');
  });

  it('removes what a write cut short left behind once it is a day old, and never lists it', async () => {
    const { server, provider } = providerOver(
      {},
      { conditionalRequests: false, moveReplace: true, revisionKind: 'etag' }
    );
    const stale = '.main.pwv.00000000-0000-4000-8000-000000000000.tmp';
    const fresh = '.main.pwv.11111111-1111-4111-8111-111111111111.tmp';
    server.putDirectly(`Vault/${stale}`, Uint8Array.of(0), LATER.subtract({ hours: 25 }));
    server.putDirectly(`Vault/${fresh}`, Uint8Array.of(0), LATER.subtract({ hours: 1 }));

    const listed = await provider.list(storagePath('Vault'), SIGNAL);
    await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);

    expect(listed).toEqual({ ok: true, value: [] });
    expect(server.paths()).toEqual([`Vault/${fresh}`, 'Vault/main.pwv']);
  });

  it('skips an entry whose address the server wrote with a bare percent sign', () => {
    const transport = createWebDavTransport(FAKE_ACCOUNT, createFakeWebDavServer().fetch);

    expect(transport.pathOf('/remote.php/dav/files/me/Vaults/100%.pwv')).toBeNull();
  });

  it('asks for the password again when the server refuses it', async () => {
    const server = createFakeWebDavServer();
    const transport = createWebDavTransport({ ...FAKE_ACCOUNT, password: 'wrong' }, server.fetch);
    const provider = createWebDavProvider({
      transport,
      features: { conditionalRequests: true, moveReplace: true, revisionKind: 'etag' },
    });

    expect(await provider.read(FILE, SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'auth-required' },
    });
  });
});

describe('webdav probe', () => {
  function probe(options: IFakeWebDavOptions, account = FAKE_ACCOUNT) {
    const server = createFakeWebDavServer(options);
    return {
      server,
      result: probeWebDav(createWebDavTransport(account, server.fetch), SIGNAL),
    };
  }

  it('finds a server that compares and writes in one request, and leaves nothing behind', async () => {
    const { server, result } = probe({});

    expect(await result).toEqual({
      ok: true,
      value: { conditionalRequests: true, moveReplace: true, revisionKind: 'etag' },
    });
    expect(server.paths()).toEqual([]);
  });

  it('falls back to checking first where CORS or the server ignores the conditions', async () => {
    expect(await probe({ corsAllowsConditions: false }).result).toMatchObject({
      ok: true,
      value: { conditionalRequests: false, moveReplace: true },
    });
    expect(await probe({ conditionalRequests: false }).result).toMatchObject({
      ok: true,
      value: { conditionalRequests: false },
    });
  });

  it('tells apart a server whose MOVE overwrites regardless, and one with no ETags', async () => {
    expect(await probe({ moveReplace: false }).result).toMatchObject({
      ok: true,
      value: { moveReplace: false },
    });
    expect(await probe({ etags: false }).result).toMatchObject({
      ok: true,
      value: { conditionalRequests: false, revisionKind: 'last-modified' },
    });
  });

  it('does not trust a server that refuses even the right If-Match to compare writes', async () => {
    expect(await probe({ refusesEveryIfMatch: true }).result).toMatchObject({
      ok: true,
      value: { conditionalRequests: false },
    });
  });

  it('removes its trial files even when the check is cancelled half way', async () => {
    const server = createFakeWebDavServer();
    const controller = new AbortController();
    let requests = 0;
    const cancelling: typeof fetch = (input, init) => {
      requests += 1;
      if (requests === 4) {
        controller.abort();
      }
      return server.fetch(input, init);
    };

    const result = await probeWebDav(
      createWebDavTransport(FAKE_ACCOUNT, cancelling),
      controller.signal
    );

    expect(result).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(server.paths()).toEqual([]);
  });

  it('says CORS when the page cannot reach the server, and auth when the password is wrong', async () => {
    expect(await probe({ corsBlocked: true }).result).toEqual({
      ok: false,
      error: { kind: 'cors-blocked' },
    });
    expect(await probe({}, { ...FAKE_ACCOUNT, password: 'wrong' }).result).toEqual({
      ok: false,
      error: { kind: 'auth-required' },
    });
  });

  it('refuses an address that names a file, not a folder', async () => {
    const server = createFakeWebDavServer();
    server.putDirectly('main.pwv', Uint8Array.of(1));
    const transport = createWebDavTransport(
      { ...FAKE_ACCOUNT, endpoint: `${FAKE_ACCOUNT.endpoint}main.pwv` },
      server.fetch
    );

    expect(await probeWebDav(transport, SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'not-a-folder' },
    });
  });
});
