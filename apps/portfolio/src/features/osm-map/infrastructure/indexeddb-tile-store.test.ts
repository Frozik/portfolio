import 'fake-indexeddb/auto';

import { createIndexedDBTileStore } from './indexeddb-tile-store';

let databaseCounter = 0;

function uniqueDatabaseName(): string {
  databaseCounter += 1;
  return `osm-map-tiles-test-${databaseCounter}`;
}

function blob(text: string): Blob {
  return new Blob([text]);
}

/** Structured cloning in the test runtime may hand back a plain object, so the size is what is compared. */
async function sizeOf(store: { get(key: number): Promise<Blob | undefined> }, key: number) {
  return (await store.get(key))?.size;
}

async function settleClock(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 2));
}

describe('IndexedDB tile store', () => {
  it('returns what was stored, the latest write winning', async () => {
    const store = createIndexedDBTileStore(uniqueDatabaseName(), 10);

    await store.set(1, blob('one'));
    await store.set(1, blob('one again'));

    expect(await sizeOf(store, 1)).toBe('one again'.length);
    expect(await store.get(2)).toBeUndefined();
  });

  it('forgets the least recently read tiles once past the ceiling', async () => {
    const store = createIndexedDBTileStore(uniqueDatabaseName(), 3);

    await store.set(1, blob('1'));
    await settleClock();
    await store.set(2, blob('2'));
    await settleClock();
    await store.set(3, blob('3'));
    await settleClock();
    await store.get(1);
    await settleClock();
    await store.set(4, blob('4'));

    expect(await store.get(2)).toBeUndefined();
    expect(await store.get(1)).toBeDefined();
    expect(await store.get(4)).toBeDefined();
  });

  it('remembers tiles across a reopen of the same database', async () => {
    const name = uniqueDatabaseName();
    await createIndexedDBTileStore(name, 10).set(7, blob('seven'));

    const reopened = createIndexedDBTileStore(name, 10);

    expect(await sizeOf(reopened, 7)).toBe('seven'.length);
  });
});
