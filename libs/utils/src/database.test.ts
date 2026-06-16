import 'fake-indexeddb/auto';

import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import { describe, expect, it, vi } from 'vitest';

import { EDatabaseErrorCallbackType, getDatabaseVersion, openVersionedDatabase } from './database';

interface TTestSchema extends DBSchema {
  items: { key: string; value: { id: string } };
}

type TUpgradeCallback = (database: IDBPDatabase<TTestSchema>, oldVersion: number) => void;

let databaseCounter = 0;

function uniqueDatabaseName(): string {
  databaseCounter += 1;
  return `versioned-database-${databaseCounter}`;
}

describe('getDatabaseVersion', () => {
  it('returns undefined for a database that does not exist', async () => {
    const version = await getDatabaseVersion(uniqueDatabaseName());
    expect(version).toBeUndefined();
  });

  it('returns the on-disk version for an existing database', async () => {
    const databaseName = uniqueDatabaseName();
    const database = await openDB(databaseName, 3);
    database.close();

    const version = await getDatabaseVersion(databaseName);
    expect(version).toBe(3);
  });
});

describe('openVersionedDatabase', () => {
  it('invokes the upgrade callback when creating a new database', async () => {
    const databaseName = uniqueDatabaseName();
    const upgrade = vi.fn<TUpgradeCallback>(database => {
      database.createObjectStore('items');
    });

    const database = await openVersionedDatabase<TTestSchema>(databaseName, 1, upgrade);

    expect(upgrade).toHaveBeenCalledTimes(1);
    expect(upgrade.mock.calls[0][1]).toBe(0);
    expect(database.objectStoreNames).toContain('items');
    expect(database.version).toBe(1);
    database.close();
  });

  it('never downgrades: resolves the version to Math.max(existing, requested)', async () => {
    const databaseName = uniqueDatabaseName();

    // Bump the on-disk version to 5.
    const initial = await openDB(databaseName, 5);
    initial.close();

    // Request a LOWER version — the helper must keep the existing higher one.
    const upgrade = vi.fn<TUpgradeCallback>();
    const database = await openVersionedDatabase<TTestSchema>(databaseName, 2, upgrade);

    expect(database.version).toBe(5);
    // No upgrade transaction runs because the resolved version equals the
    // on-disk version.
    expect(upgrade).not.toHaveBeenCalled();
    database.close();
  });

  it('upgrades to the requested version when it is higher than the existing one', async () => {
    const databaseName = uniqueDatabaseName();

    const initial = await openDB(databaseName, 1);
    initial.close();

    const upgrade = vi.fn<TUpgradeCallback>();
    const database = await openVersionedDatabase<TTestSchema>(databaseName, 4, upgrade);

    expect(database.version).toBe(4);
    expect(upgrade).toHaveBeenCalledTimes(1);
    expect(upgrade.mock.calls[0][1]).toBe(1);
    database.close();
  });

  it('routes a blocked lifecycle event to the error callback when a prior connection holds the database', async () => {
    const databaseName = uniqueDatabaseName();
    const errors: EDatabaseErrorCallbackType[] = [];
    let signalBlocked: () => void = () => undefined;
    const blockedFired = new Promise<void>(resolve => {
      signalBlocked = resolve;
    });
    const onError = vi.fn((type: EDatabaseErrorCallbackType) => {
      errors.push(type);
      if (type === EDatabaseErrorCallbackType.Blocked) {
        signalBlocked();
      }
    });

    // A plain v1 connection that ignores `versionchange` keeps the database busy
    // so the v2 open below is reported as blocked.
    const blocker = await openDB(databaseName, 1);
    blocker.onversionchange = null;

    const upgradePromise = openVersionedDatabase<TTestSchema>(
      databaseName,
      2,
      () => undefined,
      onError
    );

    // Await the actual `blocked` notification — a fixed-tick wait races under
    // full-suite load. Then release the blocker so the upgrade can complete.
    await blockedFired;
    expect(errors).toContain(EDatabaseErrorCallbackType.Blocked);

    blocker.close();
    const upgraded = await upgradePromise;
    expect(upgraded.version).toBe(2);
    upgraded.close();
  });
});
