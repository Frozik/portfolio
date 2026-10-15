import 'fake-indexeddb/auto';

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { createIndexedDbProvider } from '@frozik/cloud-storage/indexeddb/indexeddb-provider';
import { createSqlProvider } from '@frozik/cloud-storage/sql/sql-provider';
import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { createNodeSqliteDriver } from '@frozik/utils/sql/testing/node-sqlite-driver';
import { openDB } from 'idb';

import { createInThreadCodec } from '../codec/in-thread-codec';
import { utf8 } from '../crypto/bytes';
import { deriveAesKey } from '../crypto/hkdf';
import { allFields } from '../model/card';
import { createCard, putCard } from '../model/card-edits';
import { setFieldValue } from '../model/field-edits';
import { BANK_CARD_TEMPLATE } from '../model/templates/bank-card';
import type { IRandom } from '../ports/random';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import { aManifest, aVault } from '../testing/vault-file-fixtures';
import { createIndexedDbDeviceStores } from './indexeddb/device-stores';
import type { IDeviceStores } from './ports';
import { sealRecord } from './record-cipher';
import { createSqlDeviceStores } from './sql/device-stores';

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

/** The vault, a draft, provider credentials, usage, a snapshot and the registry, written through the device's stores. */
async function writeEverySecret(
  localCopy: IStorageProvider,
  openStores: (random: IRandom) => IDeviceStores
): Promise<void> {
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

  await localCopy.write(
    storagePath('vault.pwv'),
    sealed.value,
    { kind: 'absent' },
    new AbortController().signal
  );
  const stores = openStores(random);
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
}

function expectNoSecretIn(stored: readonly Uint8Array[]): void {
  expect(stored.length).toBeGreaterThan(0);
  for (const secret of Object.values(SECRETS)) {
    for (const encoded of [utf8(secret), utf16(secret)]) {
      expect({ secret, leaked: stored.some(chunk => contains(chunk, encoded)) }).toEqual({
        secret,
        leaked: false,
      });
    }
  }
}

/**
 * What DevTools shows of IndexedDB, or a phone's SQLite file, is ciphertext
 * and plain metadata only: no field value, no draft, no provider password,
 * in any encoding, whichever store wrote it.
 */
describe('nothing secret at rest', () => {
  it('keeps every secret of the vault, its drafts and its device records out of IndexedDB', async () => {
    await writeEverySecret(createIndexedDbProvider('pwv:vault:at-rest'), random =>
      createIndexedDbDeviceStores(random, 'pwv:device:at-rest')
    );

    expectNoSecretIn(await everythingStored());
  });

  it('keeps them out of the SQLite file a phone keeps', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'pwv-at-rest-'));
    const file = join(folder, 'device.sqlite');
    const driver = createNodeSqliteDriver(file);

    await writeEverySecret(createSqlProvider({ driver, namespace: 'v1' }), random =>
      createSqlDeviceStores(driver, random)
    );

    expectNoSecretIn([readFileSync(file)]);
    rmSync(folder, { recursive: true, force: true });
  });
});
