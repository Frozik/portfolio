import type { IStateStorage, IStoredState } from './core';

const DEFAULT_PREFIX = 'table:';

/** Browser local storage under `<prefix><tableId>`; unreadable entries are treated as absent. */
export function localStateStorage(prefix = DEFAULT_PREFIX): IStateStorage {
  return {
    load: tableId => {
      const raw = globalThis.localStorage.getItem(prefix + tableId);
      if (raw === null) {
        return undefined;
      }
      try {
        return JSON.parse(raw) as IStoredState;
      } catch {
        return undefined;
      }
    },
    save: (tableId, stored) => {
      globalThis.localStorage.setItem(prefix + tableId, JSON.stringify(stored));
    },
    remove: tableId => {
      globalThis.localStorage.removeItem(prefix + tableId);
    },
  };
}
