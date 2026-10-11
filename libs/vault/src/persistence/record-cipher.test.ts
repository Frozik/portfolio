import { deriveAesKey, importHkdfKey } from '../crypto/hkdf';
import { createSeededRandom } from '../testing/seeded-random';
import { openRecord, sealRecord } from './record-cipher';

async function draftKey(seed: number): Promise<CryptoKey> {
  return deriveAesKey(await importHkdfKey(createSeededRandom(seed).bytes(32)), 'pwv/draft');
}

describe('sealed device records', () => {
  const slot = { vaultKey: 'a1b2', recordKey: 'card-1' };
  const draft = { title: 'Bank', fields: [{ label: 'PIN', value: '0420' }] };

  it('open to the value they were sealed with', async () => {
    const key = await draftKey(1);

    const sealed = await sealRecord(key, slot, draft, createSeededRandom(2));

    expect(await openRecord(key, slot, sealed)).toEqual({ ok: true, value: draft });
  });

  it('do not open in another slot of the store, or with another vault key', async () => {
    const key = await draftKey(1);
    const sealed = await sealRecord(key, slot, draft, createSeededRandom(2));

    expect(await openRecord(key, { ...slot, recordKey: 'card-2' }, sealed)).toEqual({
      ok: false,
      error: 'corrupted',
    });
    expect(await openRecord(key, { ...slot, vaultKey: 'other' }, sealed)).toEqual({
      ok: false,
      error: 'corrupted',
    });
    expect(await openRecord(await draftKey(3), slot, sealed)).toEqual({
      ok: false,
      error: 'corrupted',
    });
  });
});
