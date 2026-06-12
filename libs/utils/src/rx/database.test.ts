import type { DBSchema, IDBPDatabase } from 'idb';
import { describe, expect, it, vi } from 'vitest';

import type { TDatabaseCreator } from './database';
import { createDatabase$, EDatabaseErrorCallbackType } from './database';

type TFakeDatabase = IDBPDatabase<DBSchema> & { close: ReturnType<typeof vi.fn> };

function createFakeDatabase(): TFakeDatabase {
  // Structural stub — createDatabase$ only ever calls close() on the handle
  return { close: vi.fn() } as unknown as TFakeDatabase;
}

function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

/** Promise whose resolver is exposed so the test controls when the open settles */
function createDeferredDatabase(): {
  promise: Promise<TFakeDatabase>;
  resolve: (database: TFakeDatabase) => void;
} {
  let resolve!: (database: TFakeDatabase) => void;
  const promise = new Promise<TFakeDatabase>(innerResolve => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('createDatabase$', () => {
  it('emits the opened database and closes it on unsubscribe', async () => {
    const fakeDatabase = createFakeDatabase();
    const creator: TDatabaseCreator<DBSchema> = () => Promise.resolve(fakeDatabase);

    const received: IDBPDatabase<DBSchema>[] = [];
    const subscription = createDatabase$(creator).subscribe(database => {
      received.push(database);
    });
    await flushMicrotasks();

    expect(received).toEqual([fakeDatabase]);
    expect(fakeDatabase.close).not.toHaveBeenCalled();

    subscription.unsubscribe();
    expect(fakeDatabase.close).toHaveBeenCalledTimes(1);
  });

  it('closes the connection when unsubscribed BEFORE the open resolves (no leak)', async () => {
    const fakeDatabase = createFakeDatabase();
    const deferred = createDeferredDatabase();
    const creator: TDatabaseCreator<DBSchema> = () => deferred.promise;

    const received: IDBPDatabase<DBSchema>[] = [];
    const subscription = createDatabase$(creator).subscribe(database => {
      received.push(database);
    });

    // Unsubscribe while the open is still pending — teardown runs with no db yet
    subscription.unsubscribe();

    // The open now resolves — the connection must be closed, not leaked
    deferred.resolve(fakeDatabase);
    await flushMicrotasks();

    expect(received).toEqual([]);
    expect(fakeDatabase.close).toHaveBeenCalledTimes(1);
  });

  it('errors when the creator rejects', async () => {
    const failure = new Error('open failed');
    const creator: TDatabaseCreator<DBSchema> = () => Promise.reject(failure);

    const error = await new Promise<unknown>(resolve => {
      createDatabase$(creator).subscribe({
        next: () => undefined,
        error: resolve,
      });
    });

    expect(error).toBe(failure);
  });

  it('errors via the reconnect callback when the database enters a bad state', async () => {
    const fakeDatabase = createFakeDatabase();
    let capturedCallback: ((type: EDatabaseErrorCallbackType) => void) | undefined;
    const creator: TDatabaseCreator<DBSchema> = callback => {
      capturedCallback = callback;
      return Promise.resolve(fakeDatabase);
    };

    const events: string[] = [];
    let capturedError: Error | undefined;
    createDatabase$(creator).subscribe({
      next: () => events.push('next'),
      error: (error: Error) => {
        capturedError = error;
      },
    });
    await flushMicrotasks();

    expect(events).toEqual(['next']);

    // A blocking/terminated event after the handle is open surfaces as an error
    capturedCallback?.(EDatabaseErrorCallbackType.Blocking);
    expect(capturedError?.message).toContain(EDatabaseErrorCallbackType.Blocking);
  });
});
