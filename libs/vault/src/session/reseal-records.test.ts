import 'fake-indexeddb/auto';

import { generateDek, importDek } from '../crypto/dek';
import { createIndexedDbDeviceStores } from '../persistence/indexeddb/device-stores';
import type { TVaultKey } from '../persistence/ports';
import { createSeededRandom } from '../testing/seeded-random';
import { resealRecords } from './reseal-records';
import { createSealedJsonRecord } from './sealed-json-record';

const VAULT = 'vault-1' as TVaultKey;

describe('re-sealing device records after a key rotation', () => {
  it('opens them under the new key, and drops one the old key does not open', async () => {
    const random = createSeededRandom(2);
    const stores = createIndexedDbDeviceStores(random, 'pwv:reseal-test');
    const [oldDek, newDek, otherDek] = await Promise.all(
      [1, 2, 3].map(() => importDek(generateDek(random)))
    );
    const record = (dek: CryptoKey, recordKey: string) =>
      createSealedJsonRecord({
        store: stores.deviceConfig,
        vaultKey: VAULT,
        recordKey,
        dek,
        label: 'pwv/device-config',
        random,
        decode: value => value,
      });
    await record(oldDek, 'settings').save({ idle: 5 });
    await record(otherDek, 'stray').save({ any: true });

    await resealRecords({
      store: stores.deviceConfig,
      vaultKey: VAULT,
      label: 'pwv/device-config',
      from: oldDek,
      to: newDek,
      random,
    });

    expect(await record(newDek, 'settings').load()).toEqual({ idle: 5 });
    expect(await record(oldDek, 'settings').load()).toBeNull();
    expect(await stores.deviceConfig.keys(VAULT)).toEqual({ ok: true, value: ['settings'] });

    await resealRecords({
      store: stores.deviceConfig,
      vaultKey: VAULT,
      label: 'pwv/device-config',
      from: oldDek,
      to: newDek,
      random,
    });
    expect(await record(newDek, 'settings').load()).toEqual({ idle: 5 });
  });
});
