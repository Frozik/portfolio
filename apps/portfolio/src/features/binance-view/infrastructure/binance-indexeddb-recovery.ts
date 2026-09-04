import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';

import type { IBinanceDb } from '../domain/binance-db';

import { openBinanceDb } from './binance-indexeddb';

export type BinanceDbOpenResult =
  | { readonly kind: 'opened'; readonly db: IBinanceDb }
  | { readonly kind: 'unavailable'; readonly reason: ValueDescriptorFail };

/**
 * Resolving on `blocked` is deliberate: another tab holding the DB open
 * would otherwise stall this promise forever; `openBinanceDb` then waits
 * for that tab to close its connection.
 */
function deleteDatabase(dbName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = (): void => resolve();
    request.onerror = (): void => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = (): void => resolve();
  });
}

function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

/**
 * Opens the Binance database and clears leftover blocks from the previous
 * session. A `QuotaExceededError` gets one recovery attempt — delete the
 * database and reopen it — because a device that filled its quota would
 * otherwise be stuck without history for good. Any other failure is
 * reported so the caller can run in memory and tell the user why.
 */
export async function openBinanceDbWithQuotaRecovery(dbName: string): Promise<BinanceDbOpenResult> {
  try {
    const db = await openBinanceDb(dbName);
    await db.clearAll();
    return { kind: 'opened', db };
  } catch (error) {
    if (!isQuotaExceeded(error)) {
      return { kind: 'unavailable', reason: toFail(error) };
    }
  }

  try {
    await deleteDatabase(dbName);
    return { kind: 'opened', db: await openBinanceDb(dbName) };
  } catch (recoveryError) {
    return { kind: 'unavailable', reason: toFail(recoveryError) };
  }
}
