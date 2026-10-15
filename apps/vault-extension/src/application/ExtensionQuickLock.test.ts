import type { Milliseconds } from '@frozik/utils/date/types';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { createMemoryDevice } from '@frozik/vault/testing/memory-device-stores';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';

import type { ISessionKey } from '../domain/ports';
import type { IQuickLockRecord } from '../domain/quick-unlock';
import { ExtensionQuickLock, QUICK_LIFETIME_MS } from './ExtensionQuickLock';

const DAY_MS = 24 * 60 * 60 * 1000;
const PIN = '2468';

function aQuickLock() {
  const random = createSeededRandom(5);
  let record: IQuickLockRecord | null = null;
  const masters = new Map<string, Milliseconds>();
  let now = 1_000_000;
  const expiries: number[] = [];
  const quick = new ExtensionQuickLock({
    deviceConfig: createMemoryDevice()(random).deviceConfig,
    quickLocks: {
      load: () => Promise.resolve(record),
      save: next => {
        record = next;
        return Promise.resolve();
      },
      clear: () => {
        record = null;
        return Promise.resolve();
      },
    },
    lastMaster: {
      load: vaultKey => Promise.resolve(masters.get(vaultKey) ?? null),
      save: (vaultKey, at) => {
        masters.set(vaultKey, at);
        return Promise.resolve();
      },
    },
    expiry: {
      set: delay => {
        expiries.push(delay);
        return Promise.resolve();
      },
      cancel: () => Promise.resolve(),
    },
    random,
    now: () => now,
  });
  const key: ISessionKey = {
    vaultKey: 'vault' as TVaultKey,
    rawDek: random.bytes(32),
    keyId: random.bytes(16),
  };
  return {
    quick,
    key,
    record: () => record,
    expiries,
    later: (ms: number) => {
      now += ms;
    },
  };
}

describe('the extension’s quick unlock', () => {
  it('keeps the key behind the PIN at the idle lock, and the PIN opens it once', async () => {
    const { quick, key, expiries } = aQuickLock();
    await quick.setUp(key, PIN);

    const locked = await quick.lock(key);
    const prompt = await quick.prompt();
    const opened = await quick.open(PIN);

    expect([locked, prompt, expiries]).toEqual([true, { digits: 4 }, [QUICK_LIFETIME_MS]]);
    expect(opened?.rawDek).toEqual(key.rawDek);
    expect(await quick.prompt()).toBeNull();
  });

  it('keeps neither the key nor the PIN in the open', async () => {
    const { quick, key, record } = aQuickLock();
    await quick.setUp(key, PIN);
    await quick.lock(key);

    const stored = JSON.stringify(record(), (_, value: unknown) =>
      value instanceof Uint8Array ? [...value] : value
    );

    expect(stored).not.toContain([...key.rawDek].join(','));
    expect(stored).not.toContain(PIN);
  });

  it('gives one try: a wrong PIN leaves nothing to try again', async () => {
    const { quick, key } = aQuickLock();
    await quick.setUp(key, PIN);
    await quick.lock(key);

    expect(await quick.open('1111')).toBeNull();
    expect(await quick.open(PIN)).toBeNull();
  });

  it('locks fully without a PIN, and stops after it is switched off', async () => {
    const { quick, key } = aQuickLock();

    expect(await quick.lock(key)).toBe(false);
    await quick.setUp(key, PIN);
    await quick.switchOff(key);
    expect(await quick.lock(key)).toBe(false);
  });

  it('reminds of the master password a week after it was last typed', async () => {
    const { quick, key, later } = aQuickLock();
    await quick.masterTyped(key.vaultKey);
    later(6 * DAY_MS);
    const early = await quick.reminderDue(key.vaultKey);
    later(DAY_MS);

    expect([early, await quick.reminderDue(key.vaultKey)]).toEqual([false, true]);
  });
});
