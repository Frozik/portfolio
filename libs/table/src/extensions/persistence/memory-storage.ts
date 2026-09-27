import type { IStateStorage, IStoredState } from './core';

/** In-memory storage: state survives re-creating a table within one page, and nothing longer. */
export function memoryStateStorage(): IStateStorage & {
  readonly states: ReadonlyMap<string, IStoredState>;
} {
  const states = new Map<string, IStoredState>();
  return {
    states,
    load: tableId => states.get(tableId),
    save: (tableId, stored) => {
      states.set(tableId, stored);
    },
    remove: tableId => {
      states.delete(tableId);
    },
  };
}
