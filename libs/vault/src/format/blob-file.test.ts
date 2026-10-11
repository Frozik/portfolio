import type { TAssetId } from '../model/ids';
import { createSeededRandom } from '../testing/seeded-random';
import { newBlobKey, openBlob, sealBlob } from './blob-file';

const ASSET = 'asset-1' as TAssetId;
const CONTENT = Uint8Array.from({ length: 200_000 }, (_, index) => (index * 31) % 251);

describe('external blobs', () => {
  it('open with their key to the bytes sealed, across several chunks', async () => {
    const key = newBlobKey(createSeededRandom(1));

    const opened = await openBlob(key, ASSET, await sealBlob(key, ASSET, CONTENT));

    expect(opened).toEqual({ ok: true, value: CONTENT });
  });

  it('refuse another key, another asset’s name and a changed byte', async () => {
    const random = createSeededRandom(2);
    const key = newBlobKey(random);
    const file = await sealBlob(key, ASSET, CONTENT);
    const tampered = file.slice();
    tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;

    expect(await openBlob(newBlobKey(random), ASSET, file)).toEqual({
      ok: false,
      error: 'corrupted',
    });
    expect(await openBlob(key, 'asset-2' as TAssetId, file)).toEqual({
      ok: false,
      error: 'corrupted',
    });
    expect(await openBlob(key, ASSET, tampered)).toEqual({ ok: false, error: 'corrupted' });
  });

  it('tell a file that is no blob', async () => {
    const key = newBlobKey(createSeededRandom(3));

    expect(await openBlob(key, ASSET, Uint8Array.of(1, 2, 3))).toEqual({
      ok: false,
      error: 'unsupported-format',
    });
  });
});
