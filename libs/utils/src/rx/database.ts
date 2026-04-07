import type { DBSchema, IDBPDatabase } from 'idb';
import type { MonoTypeOperatorFunction } from 'rxjs';
import { Observable, retry, timer } from 'rxjs';

export enum EDatabaseErrorCallbackType {
  Blocked = 'Blocked',
  Blocking = 'Blocking',
  Terminated = 'Terminated',
}

export type TDatabaseErrorCallback = (type: EDatabaseErrorCallbackType) => void | Promise<void>;

export type TDatabaseCreator<T extends DBSchema> = (
  callback: TDatabaseErrorCallback
) => Promise<IDBPDatabase<T>>;

export function createDatabase$<T extends DBSchema>(
  creator: TDatabaseCreator<T>
): Observable<IDBPDatabase<T>> {
  return new Observable<IDBPDatabase<T>>(observer => {
    let db: IDBPDatabase<T> | undefined;

    creator((type: EDatabaseErrorCallbackType) => {
      observer.error(new Error(`Database is in '${type}' state, reconnecting`));
    }).then(
      database => {
        db = database;
        observer.next(database);
      },
      error => {
        observer.error(error);
      }
    );

    // Close the database connection when the observable is unsubscribed
    return () => {
      db?.close();
    };
  });
}

const INITIAL_RETRY_INTERVAL = 5_000;
const JITTER = 1_000;

export function databaseReconnect<T extends DBSchema>(): MonoTypeOperatorFunction<IDBPDatabase<T>> {
  return retry({
    delay: (_error, retryCount) => {
      const jitter = Math.random() * JITTER;
      const delay = INITIAL_RETRY_INTERVAL * retryCount + jitter;
      return timer(delay);
    },
  });
}
