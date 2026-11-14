import { reloadAppAsync } from 'expo';

import { runtimeReloadWipe } from './runtime-reload-wipe';

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

const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('the runtime reload wipe', () => {
  beforeEach(() => jest.mocked(reloadAppAsync).mockClear());

  it('starts a new runtime that learns once why its vault was locked', async () => {
    const wipe = runtimeReloadWipe(() => Promise.resolve());
    wipe.wipe({ vaultKey: 'a1b2', reason: 'idle' });
    await settled();

    expect(reloadAppAsync).toHaveBeenCalled();
    expect(wipe.takeNote('a1b2')).toBe('idle');
    expect(wipe.takeNote('a1b2')).toBeNull();
  });

  it('tells another vault nothing', () => {
    const wipe = runtimeReloadWipe(() => Promise.resolve());
    wipe.wipe({ vaultKey: 'a1b2', reason: 'manual' });

    expect(wipe.takeNote('c3d4')).toBeNull();
  });

  it('reloads only once the database has settled, so no write is cut in half', async () => {
    let settleDatabase = (): void => undefined;
    const wipe = runtimeReloadWipe(
      () =>
        new Promise(resolve => {
          settleDatabase = resolve;
        })
    );
    wipe.wipe({ vaultKey: 'a1b2', reason: 'manual' });
    await settled();
    expect(reloadAppAsync).not.toHaveBeenCalled();

    settleDatabase();
    await settled();

    expect(reloadAppAsync).toHaveBeenCalled();
  });

  it('reloads even when the database cannot settle', async () => {
    runtimeReloadWipe(() => Promise.reject(new Error('busy'))).wipe({
      vaultKey: 'a1b2',
      reason: 'manual',
    });
    await settled();

    expect(reloadAppAsync).toHaveBeenCalled();
  });
});
