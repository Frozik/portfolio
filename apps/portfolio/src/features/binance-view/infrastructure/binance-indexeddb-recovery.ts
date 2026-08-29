import type { IBinanceDb } from '../domain/binance-db';

import { openBinanceDb } from './binance-indexeddb';

/**
 * Drop the whole database so the next open starts from a clean quota
 * budget. Resolving on `blocked` is deliberate: another tab holding the
 * DB open would otherwise stall this promise forever. `openBinanceDb`
 * blocks until that tab closes its connection, and on success we end up
 * with a freshly-open DB that's already past the quota wall.
 */
function deleteDatabase(dbName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = (): void => resolve();
    request.onerror = (): void => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = (): void => resolve();
  });
}

/**
 * Open the Binance database and clear leftover blocks from the previous
 * session. Persistence is best-effort: any failure resolves to
 * `undefined` so the feature keeps running purely in memory.
 *
 * A `QuotaExceededError` gets one recovery attempt — delete the database
 * and reopen it — because a device that filled its quota would otherwise
 * be stuck without history for good.
 */
export async function openBinanceDbWithQuotaRecovery(
  dbName: string
): Promise<IBinanceDb | undefined> {
  let db: IBinanceDb | undefined;

  try {
    db = await openBinanceDb(dbName);
    await db.clearAll();
    return db;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'QuotaExceededError')) {
      // biome-ignore lint/suspicious/noConsole: surfaces silent IndexedDB failure (private mode, quota)
      console.warn('binance-view: IndexedDB unavailable, history will not persist', error);
      return undefined;
    }

    // biome-ignore lint/suspicious/noConsole: surfaces quota recovery
    console.warn('binance-view: IDB quota exceeded, deleting database for fresh start');
    db?.close();

    try {
      await deleteDatabase(dbName);
      return await openBinanceDb(dbName);
    } catch (recoveryError) {
      // biome-ignore lint/suspicious/noConsole: surfaces unrecoverable IDB failure
      console.warn('binance-view: IDB recovery failed, persistence disabled', recoveryError);
      return undefined;
    }
  }
}
