import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import { isNil } from 'lodash-es';

import type { IBinanceDb } from '../domain/binance-db';

/**
 * Single owner of "may we still write to IndexedDB?". Every stream store
 * reads `db` at the moment of a write; the first failure disables the gate
 * for the rest of the session and reports the reason upward, so the
 * orchestrator shows it instead of each store logging and carrying on.
 */
export class PersistenceGate {
  private database: IBinanceDb | undefined;

  constructor(
    database: IBinanceDb | undefined,
    private readonly onDisabled: (reason: ValueDescriptorFail) => void
  ) {
    this.database = database;
  }

  get db(): IBinanceDb | undefined {
    return this.database;
  }

  disable(reason: ValueDescriptorFail): void {
    if (isNil(this.database)) {
      return;
    }
    this.database = undefined;
    this.onDisabled(reason);
  }

  /** Runs a write; a rejection disables persistence instead of escaping as an unhandled promise. */
  write(operation: (db: IBinanceDb) => Promise<void>): void {
    const db = this.database;
    if (isNil(db)) {
      return;
    }
    operation(db).catch((error: unknown) => {
      this.disable(toFail(error));
    });
  }
}
