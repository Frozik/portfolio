import 'fake-indexeddb/auto';

import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { createIndexedDbProvider } from '@frozik/cloud-storage/indexeddb/indexeddb-provider';
import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { openDB } from 'idb';

import { createInThreadCodec } from '../codec/in-thread-codec';
import { utf8 } from '../crypto/bytes';
import { deriveAesKey } from '../crypto/hkdf';
import { allFields } from '../model/card';
import { createCard, putCard } from '../model/card-edits';
import { setFieldValue } from '../model/field-edits';
import { BANK_CARD_TEMPLATE } from '../model/templates/bank-card';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import { aManifest, aVault } from '../testing/vault-file-fixtures';
import { createIndexedDbDeviceStores } from './indexeddb/device-stores';
import { sealRecord } from './record-cipher';

const SECRETS = {
  cardNumber: '4111 1111 1111 1111',
  vaultPassword: 'correct horse battery staple',
  draftSecret: 'draft-only-secret-Ω',
  webdavPassword: 'webdav-app-password-ß',
  usageCanary: 'usage-canary-card-id',
};

function utf16(text: string): Uint8Array {
  return Uint8Array.from(
    [...text].flatMap(character => {
      const code = character.charCodeAt(0);
      return [code & 0xff, code >> 8];
    })
  );
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

/** Every byte a database keeps: strings as UTF-8 and UTF-16, byte arrays as they are. */
async function everythingStored(): Promise<readonly Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const collect = (value: unknown): void => {
    if (value instanceof Uint8Array) {
      chunks.push(value);
    } else if (typeof value === 'string') {
      chunks.push(utf8(value), utf16(value));
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, entry]) => {
        collect(key);
        collect(entry);
      });
    }
  };
  for (const { name } of await indexedDB.databases()) {
    assert(name !== undefined);
    const database = await openDB(name);
    for (const store of database.objectStoreNames) {
      collect(await database.getAllKeys(store));
      collect(await database.getAll(store));
    }
    database.close();
  }
  return chunks;
}

/**
 * What DevTools shows of IndexedDB is ciphertext and plain
 * metadata only: no field value, no draft, no provider password, in any
 * encoding, whichever store wrote it.
 */
describe('nothing secret at rest', () => {
  it('keeps every secret of the vault, its drafts and its device records out of IndexedDB', async () => {
    const random = createSeededRandom(77);
    const { keys, context, dependencies } = await aVault(77);
    const card = createCard(
      BANK_CARD_TEMPLATE,
      { translate: key => key, random },
      { wallMs: 1, counter: 0, node: 'n' }
    );
    const numberField = allFields(card).find(field => field.spec.kind === 'card-number');
    assert(numberField !== undefined);
    const document = putCard(sampleVaultDocument(random), {
      ...card,
      ...setFieldValue(card, numberField.id, { cardinality: 'single', value: SECRETS.cardNumber }),
    });
    const sealed = await createInThreadCodec(dependencies).seal(
      document,
      aManifest(),
      context,
      new AbortController().signal
    );
    assert(sealed.ok);

    const localCopy = createIndexedDbProvider('pwv:vault:at-rest');
    await localCopy.write(
      storagePath('vault.pwv'),
      sealed.value,
      { kind: 'absent' },
      new AbortController().signal
    );
    const stores = createIndexedDbDeviceStores(random, 'pwv:device:at-rest');
    const slot = (recordKey: string) => ({ vaultKey: 'v1', recordKey });
    await stores.drafts.put(
      'v1',
      'card-1',
      await sealRecord(
        await deriveAesKey(keys.dek, 'pwv/draft'),
        slot('card-1'),
        { value: SECRETS.draftSecret },
        random
      )
    );
    await stores.deviceConfig.put(
      'v1',
      'provider',
      await sealRecord(
        await deriveAesKey(keys.dek, 'pwv/device-config'),
        slot('provider'),
        { password: SECRETS.webdavPassword },
        random
      )
    );
    await stores.usage.put(
      'v1',
      'usage',
      await sealRecord(
        await deriveAesKey(keys.dek, 'pwv/device-usage'),
        slot('usage'),
        { [SECRETS.usageCanary]: 1 },
        random
      )
    );
    await stores.snapshots.add(
      'v1',
      { takenAt: 1 as Milliseconds, reason: 'before-sync', file: sealed.value },
      10
    );
    await stores.registry.put({
      vaultKey: 'v1',
      name: 'Personal',
      description: '',
      lastOpenedAt: null,
      unsyncedChanges: false,
    });

    const stored = await everythingStored();

    expect(stored.length).toBeGreaterThan(0);
    for (const secret of Object.values(SECRETS)) {
      for (const encoded of [utf8(secret), utf16(secret)]) {
        expect({ secret, leaked: stored.some(chunk => contains(chunk, encoded)) }).toEqual({
          secret,
          leaked: false,
        });
      }
    }
  });
});
