import 'fake-indexeddb/auto';

import { openDB } from 'idb';

import { storagePath } from '../core/storage-path';
import { describeStorageProviderContract } from '../testing/storage-contract';
import { createIndexedDbProvider } from './indexeddb-provider';

let database = 0;

describeStorageProviderContract('indexeddb', () => {
  database += 1;
  return createIndexedDbProvider(`pwv:test-storage:${database}`);
});

describe('indexeddb storage provider', () => {
  it('keeps what it stored across a fresh provider over the same database', async () => {
    const signal = new AbortController().signal;
    const path = storagePath('Vault/main.pwv');
    const first = createIndexedDbProvider('pwv:test-storage:reopen');
    await first.write(path, Uint8Array.of(4, 2), { kind: 'absent' }, signal);

    const read = await createIndexedDbProvider('pwv:test-storage:reopen').read(path, signal);

    expect(read).toMatchObject({ ok: true, value: { bytes: Uint8Array.of(4, 2) } });
  });

  it('reads and lists what a database of the first layout kept, its bytes in the object row', async () => {
    const signal = new AbortController().signal;
    const name = 'pwv:test-storage:first-layout';
    const first = await openDB(name, 1, {
      upgrade: database => {
        database.createObjectStore('objects', { keyPath: 'path' });
        database.createObjectStore('counters');
      },
    });
    await first.put('objects', {
      path: 'vault.pwv',
      bytes: Uint8Array.of(9, 9),
      rev: '1',
      size: 2,
      modifiedAt: 5,
    });
    first.close();

    const provider = createIndexedDbProvider(name);
    const read = await provider.read(storagePath('vault.pwv'), signal);
    const listed = await provider.list(storagePath(''), signal);

    expect(read).toMatchObject({ ok: true, value: { bytes: Uint8Array.of(9, 9) } });
    expect(listed).toEqual({
      ok: true,
      value: [{ path: 'vault.pwv', rev: '1', size: 2, modifiedAt: 5 }],
    });
  });
});
