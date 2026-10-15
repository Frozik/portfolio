import { reloadAppAsync } from 'expo';

import { RUNTIME_RELOAD_WIPE } from './runtime-reload-wipe';

jest.mock('expo', () => ({ reloadAppAsync: jest.fn(() => Promise.resolve()) }));

jest.mock('expo-sqlite/kv-store', () => {
  const items = new Map<string, string>();
  return {
    Storage: {
      setItemSync: (key: string, value: string) => items.set(key, value),
      getItemSync: (key: string) => items.get(key) ?? null,
      removeItemSync: (key: string) => items.delete(key),
    },
  };
});

describe('the runtime reload wipe', () => {
  it('starts a new runtime that learns once why its vault was locked', () => {
    RUNTIME_RELOAD_WIPE.wipe({ vaultKey: 'a1b2', reason: 'idle' });

    expect(reloadAppAsync).toHaveBeenCalled();
    expect(RUNTIME_RELOAD_WIPE.takeNote('a1b2')).toBe('idle');
    expect(RUNTIME_RELOAD_WIPE.takeNote('a1b2')).toBeNull();
  });

  it('tells another vault nothing', () => {
    RUNTIME_RELOAD_WIPE.wipe({ vaultKey: 'a1b2', reason: 'manual' });

    expect(RUNTIME_RELOAD_WIPE.takeNote('c3d4')).toBeNull();
  });
});
