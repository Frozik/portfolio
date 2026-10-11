import { concatBytes, utf8 } from './bytes';
import type { IStreamParams } from './stream-cipher';
import { decryptStream, encryptStream } from './stream-cipher';

const CHUNK_SIZE = 16;
const SEALED_CHUNK = CHUNK_SIZE + 16;

async function streamParams(additionalData = utf8('header-hash')): Promise<IStreamParams> {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(32).fill(7), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  return { key, chunkSize: CHUNK_SIZE, additionalData };
}

const THREE_CHUNKS = utf8('first sixteen b.second sixteen b.tail');

describe('STREAM payload encryption', () => {
  it.each([1, 15, 16, 17, 48])('round-trips a text of %i bytes', async length => {
    const params = await streamParams();
    const plaintext = Uint8Array.from({ length }, (_, index) => index);

    const opened = await decryptStream(params, await encryptStream(params, plaintext));

    expect(opened).toEqual({ ok: true, value: plaintext });
  });

  it('refuses the stream when any single byte is flipped', async () => {
    const params = await streamParams();
    const sealed = await encryptStream(params, THREE_CHUNKS);

    for (let index = 0; index < sealed.length; index += 1) {
      const mutated = sealed.slice();
      mutated[index] = (mutated[index] ?? 0) ^ 1;
      expect(await decryptStream(params, mutated)).toEqual({ ok: false, error: 'corrupted' });
    }
  });

  it('refuses a stream cut at a chunk boundary, so a shorter text never passes as whole', async () => {
    const params = await streamParams();
    const sealed = await encryptStream(params, THREE_CHUNKS);

    expect(await decryptStream(params, sealed.slice(0, 2 * SEALED_CHUNK))).toEqual({
      ok: false,
      error: 'corrupted',
    });
  });

  it('refuses a stream with a chunk appended or two chunks swapped', async () => {
    const params = await streamParams();
    const sealed = await encryptStream(params, THREE_CHUNKS);
    const first = sealed.slice(0, SEALED_CHUNK);
    const second = sealed.slice(SEALED_CHUNK, 2 * SEALED_CHUNK);
    const rest = sealed.slice(2 * SEALED_CHUNK);

    const corrupted = { ok: false, error: 'corrupted' };
    expect(await decryptStream(params, concatBytes(sealed, rest))).toEqual(corrupted);
    expect(await decryptStream(params, concatBytes(second, first, rest))).toEqual(corrupted);
  });

  it('refuses a stream sealed under another header', async () => {
    const sealed = await encryptStream(await streamParams(), THREE_CHUNKS);

    expect(await decryptStream(await streamParams(utf8('other-header')), sealed)).toEqual({
      ok: false,
      error: 'corrupted',
    });
  });

  it('refuses an empty or tag-only stream', async () => {
    const params = await streamParams();

    expect(await decryptStream(params, new Uint8Array(0))).toEqual({
      ok: false,
      error: 'corrupted',
    });
    expect(await decryptStream(params, new Uint8Array(16))).toEqual({
      ok: false,
      error: 'corrupted',
    });
  });
});
