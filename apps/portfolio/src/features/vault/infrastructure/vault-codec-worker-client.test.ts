import { assert } from '@frozik/utils/assert/assert';
import type { IInMemoryWorkerPair } from '@frozik/utils/worker/in-memory-worker.test-helper';
import { createInMemoryWorkerPair } from '@frozik/utils/worker/in-memory-worker.test-helper';
import { serveRpc } from '@frozik/utils/worker/rpc-server';
import type { TVaultCodecContract } from '@frozik/vault/codec/serve-vault-codec';
import { serveVaultCodec } from '@frozik/vault/codec/serve-vault-codec';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { sampleVaultDocument } from '@frozik/vault/testing/sample-vault';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { aManifest, aVault, TEST_PASSWORD } from '@frozik/vault/testing/vault-file-fixtures';

import { createVaultCodecWorkerClient } from './vault-codec-worker-client';

const SIGNAL = new AbortController().signal;

async function connect(): Promise<{
  readonly codec: ReturnType<typeof createVaultCodecWorkerClient>;
  readonly spawned: IInMemoryWorkerPair[];
  readonly context: Awaited<ReturnType<typeof aVault>>['context'];
}> {
  const { context, dependencies } = await aVault();
  const spawned: IInMemoryWorkerPair[] = [];
  const codec = createVaultCodecWorkerClient(() => {
    const pair = createInMemoryWorkerPair();
    serveVaultCodec(pair.scope, dependencies);
    spawned.push(pair);
    return pair.worker;
  });
  return { codec, spawned, context };
}

describe('vault codec worker client', () => {
  it('changes the password in the Worker and zeroes both passwords on the caller’s side', async () => {
    const { codec, context } = await connect();
    const current = TEST_PASSWORD.slice();
    const next = encodePassword('another long master password');

    const changed = await codec.changePassword(
      context,
      { current: { kind: 'password', password: current }, next },
      SIGNAL
    );

    assert(changed.ok);
    expect(changed.value.keyslotsEpoch).toBe(context.keyslotsEpoch + 1);
    expect([...current, ...next].every(byte => byte === 0)).toBe(true);
  });

  it('opens what it sealed and leaves no copy of the password with the caller', async () => {
    const { codec, context } = await connect();
    const sealed = await codec.seal(
      sampleVaultDocument(createSeededRandom(3)),
      aManifest(),
      context,
      SIGNAL
    );
    assert(sealed.ok);
    const password = TEST_PASSWORD.slice();

    const opened = await codec.open(sealed.value, { kind: 'password', password }, SIGNAL);

    assert(opened.ok);
    expect(opened.value.keys.keyId).toEqual(context.keyId);
    expect(password.every(byte => byte === 0)).toBe(true);
  });

  it('stops the busy worker on abort and serves the next call from a fresh one', async () => {
    const { codec, spawned, context } = await connect();
    const document = sampleVaultDocument(createSeededRandom(3));

    const aborted = await codec.seal(document, aManifest(), context, AbortSignal.abort());
    const next = await codec.seal(document, aManifest(), context, SIGNAL);

    expect(aborted).toEqual({ ok: false, error: { kind: 'aborted' } });
    expect(spawned[0]?.isTerminated()).toBe(true);
    expect(next.ok).toBe(true);
    expect(spawned).toHaveLength(2);
  });

  it('answers a crash with "worker-crashed" and recovers on the next call', async () => {
    const { codec, spawned, context } = await connect();
    const document = sampleVaultDocument(createSeededRandom(3));
    await codec.seal(document, aManifest(), context, SIGNAL);

    const pending = codec.seal(document, aManifest(), context, SIGNAL);
    spawned[0]?.crash(new Event('error'));

    expect(await pending).toEqual({ ok: false, error: { kind: 'worker-crashed' } });
    expect((await codec.seal(document, aManifest(), context, SIGNAL)).ok).toBe(true);
  });

  it('answers a worker that threw as crashed, never with an exception, and starts a fresh one', async () => {
    const { context, dependencies } = await aVault();
    let spawned = 0;
    const codec = createVaultCodecWorkerClient(() => {
      spawned += 1;
      const pair = createInMemoryWorkerPair();
      if (spawned === 1) {
        serveRpc<TVaultCodecContract>(pair.scope, {
          createKeys: { handle: () => Promise.reject(new Error('wasm failed to load')) },
          changePassword: { handle: () => Promise.reject(new Error('wasm failed to load')) },
          addRecoveryKey: { handle: () => Promise.reject(new Error('wasm failed to load')) },
          rotateKey: { handle: () => Promise.reject(new Error('wasm failed to load')) },
          addPasskey: { handle: () => Promise.reject(new Error('wasm failed to load')) },
          open: { handle: () => Promise.reject(new Error('wasm failed to load')) },
          seal: { handle: () => Promise.reject(new Error('wasm failed to load')) },
        });
      } else {
        serveVaultCodec(pair.scope, dependencies);
      }
      return pair.worker;
    });
    const document = sampleVaultDocument(createSeededRandom(3));

    expect(await codec.seal(document, aManifest(), context, SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'worker-crashed' },
    });
    expect((await codec.seal(document, aManifest(), context, SIGNAL)).ok).toBe(true);
  });
});
