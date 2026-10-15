import { generateDek, importDek } from '@frozik/vault/crypto/dek';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';

import { createMemorySealedRecords } from '../../testing/memory-sealed-records';
import { createCloudLinkRecord } from './cloud-link-record';

const VAULT_KEY = 'a1b2';
const DRIVE = {
  kind: 'google-drive',
  space: 'my-drive',
  path: 'Vault/Family.pwv',
  account: null,
} as const;

async function aDevice() {
  const random = createSeededRandom(3);
  const dek = await importDek(generateDek(random));
  const store = createMemorySealedRecords();
  const raw = createSealedJsonRecord<unknown>({
    store,
    vaultKey: VAULT_KEY,
    recordKey: 'cloud-link',
    dek,
    label: 'pwv/device-config',
    random,
    decode: value => value,
  });
  return { raw, record: createCloudLinkRecord({ store, vaultKey: VAULT_KEY, dek, random }) };
}

describe('the sealed cloud link of a vault', () => {
  it('is written as version 2 and read back', async () => {
    const { raw, record } = await aDevice();

    await record.save(DRIVE);

    expect(await record.load()).toEqual(DRIVE);
    expect(await raw.load()).toEqual({ version: 2, link: DRIVE });
  });

  it('written by an older client is read, then kept as version 2', async () => {
    const { raw, record } = await aDevice();
    await raw.save({
      location: { kind: 'google-drive', space: 'my-drive', path: DRIVE.path },
      webdav: null,
    });

    expect(await record.load()).toEqual(DRIVE);
    expect(await raw.load()).toEqual({ version: 2, link: DRIVE });
  });
});
