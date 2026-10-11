import { assert } from '@frozik/utils/assert/assert';
import { createInMemoryWorkerPair } from '@frozik/utils/worker/in-memory-worker.test-helper';
import { createRpcClient } from '@frozik/utils/worker/rpc-client';

import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import { aManifest, aVault, TEST_PASSWORD } from '../testing/vault-file-fixtures';
import { createInThreadCodec } from './in-thread-codec';
import type { TVaultCodecContract } from './serve-vault-codec';
import { serveVaultCodec } from './serve-vault-codec';

const SIGNAL = new AbortController().signal;

describe('vault codec', () => {
  it('seals a document and opens it back with the password', async () => {
    const { context, dependencies } = await aVault();
    const codec = createInThreadCodec(dependencies);
    const document = sampleVaultDocument(createSeededRandom(3));

    const sealed = await codec.seal(document, aManifest(), context, SIGNAL);
    assert(sealed.ok);
    const opened = await codec.open(
      sealed.value,
      { kind: 'password', password: TEST_PASSWORD },
      SIGNAL
    );

    assert(opened.ok);
    expect(opened.value.document.cards).toEqual(document.cards);
    expect(opened.value.access).toBe('read-write');
  });

  it('answers an aborted call with "aborted"', async () => {
    const { context, dependencies } = await aVault();
    const codec = createInThreadCodec(dependencies);

    expect(
      await codec.seal(
        sampleVaultDocument(createSeededRandom(3)),
        aManifest(),
        context,
        AbortSignal.abort()
      )
    ).toEqual({
      ok: false,
      error: { kind: 'aborted' },
    });
  });

  it('works the same across a worker boundary: the key and the document survive structured clone', async () => {
    const { context, dependencies } = await aVault();
    const pair = createInMemoryWorkerPair();
    serveVaultCodec(pair.scope, dependencies);
    const client = createRpcClient<TVaultCodecContract>(pair.worker);
    const document = sampleVaultDocument(createSeededRandom(3));

    const sealed = await client.call('seal', { document, manifest: aManifest(), context });
    assert(sealed.ok && sealed.value.ok);
    const opened = await client.call('open', {
      file: sealed.value.value,
      unlock: { kind: 'session', dek: context.dek, keyId: context.keyId },
    });

    assert(opened.ok && opened.value.ok);
    expect(opened.value.value.document.cards).toEqual(document.cards);
  });

  it('makes the keys of a new vault that its password opens, and zeroes the password it was sent', async () => {
    const { dependencies } = await aVault();
    const pair = createInMemoryWorkerPair();
    serveVaultCodec(pair.scope, dependencies);
    const client = createRpcClient<TVaultCodecContract>(pair.worker);
    const sent = TEST_PASSWORD.slice();

    const created = await client.call(
      'createKeys',
      { password: sent },
      { transfer: [sent.buffer] }
    );
    assert(created.ok && created.value.ok);
    const keys = created.value.value;
    const sealed = await client.call('seal', {
      document: sampleVaultDocument(createSeededRandom(3)),
      manifest: aManifest(),
      context: { ...keys, revision: 1, movedTo: null, preserved: [] },
    });
    assert(sealed.ok && sealed.value.ok);
    const opened = await createInThreadCodec(dependencies).open(
      sealed.value.value,
      { kind: 'password', password: TEST_PASSWORD },
      SIGNAL
    );

    expect(sent.byteLength).toBe(0);
    assert(opened.ok);
    expect(opened.value.keys.keyId).toEqual(keys.keyId);
  });
});
