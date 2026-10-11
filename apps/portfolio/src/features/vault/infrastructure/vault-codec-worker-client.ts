import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err } from '@frozik/utils/result/result';
import type { IRpcClient, IRpcWorker, TRpcError } from '@frozik/utils/worker/rpc-client';
import { createRpcClient } from '@frozik/utils/worker/rpc-client';
import type { TVaultCodecContract } from '@frozik/vault/codec/serve-vault-codec';
import type { TCodecError, IVaultCodec } from '@frozik/vault/codec/vault-codec';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TSlotSecret } from '@frozik/vault/format/keyslot-changes';
import type { TUnlock } from '@frozik/vault/format/open-vault';

export interface IVaultCodecWorkerClient extends IVaultCodec {
  dispose(): void;
}

function spawnCodecWorker(): IRpcWorker {
  return new Worker(new URL('./vault-codec.worker.ts', import.meta.url), { type: 'module' });
}

/** Sent bytes are a copy whose buffer is transferred, so the caller's array — maybe a view of a larger buffer — stays intact. */
function transferable(bytes: TBytes): TBytes {
  return bytes.slice();
}

/** The Worker gets the only copy of a secret; the caller's is zeroed at once. */
function handOver(secret: TBytes): TBytes {
  const sent = transferable(secret);
  secret.fill(0);
  return sent;
}

function handOverSlotSecret(secret: TSlotSecret): {
  readonly secret: TSlotSecret;
  readonly transfer: ArrayBuffer;
} {
  if (secret.kind === 'password') {
    const password = handOver(secret.password);
    return { secret: { kind: 'password', password }, transfer: password.buffer };
  }
  const recoveryKey = handOver(secret.recoveryKey);
  return { secret: { kind: 'recovery', recoveryKey }, transfer: recoveryKey.buffer };
}

/** The Worker gets the only copy of the secret; the caller's is zeroed at once. */
function handOverSecret(unlock: TUnlock): {
  readonly unlock: TUnlock;
  readonly transfer: ArrayBuffer[];
} {
  switch (unlock.kind) {
    case 'password': {
      const password = transferable(unlock.password);
      unlock.password.fill(0);
      return { unlock: { ...unlock, password }, transfer: [password.buffer] };
    }
    case 'recovery': {
      const recoveryKey = transferable(unlock.recoveryKey);
      unlock.recoveryKey.fill(0);
      return { unlock: { ...unlock, recoveryKey }, transfer: [recoveryKey.buffer] };
    }
    case 'prf': {
      const prfOutput = transferable(unlock.prfOutput);
      unlock.prfOutput.fill(0);
      return { unlock: { ...unlock, prfOutput }, transfer: [prfOutput.buffer] };
    }
    case 'session':
      return { unlock, transfer: [] };
    default:
      return assertNever(unlock);
  }
}

function codecErrorOf(error: TRpcError): TCodecError {
  switch (error.kind) {
    case 'aborted':
    case 'disposed':
      return { kind: 'aborted' };
    case 'worker-crashed':
    case 'not-sent':
    case 'handler-threw':
      return { kind: 'worker-crashed' };
    default:
      return assertNever(error);
  }
}

/**
 * The codec behind a Worker. Argon2 in hash-wasm
 * cannot be interrupted, so an aborted call terminates the Worker. A Worker
 * that died, threw (its WASM did not load) or could not send its answer is
 * `worker-crashed`: a value, so no screen waits forever on a rejected
 * promise. Either way the next call starts a fresh Worker.
 */
export function createVaultCodecWorkerClient(
  spawn: () => IRpcWorker = spawnCodecWorker
): IVaultCodecWorkerClient {
  let client: IRpcClient<TVaultCodecContract> | null = null;

  const settle = <T>(
    current: IRpcClient<TVaultCodecContract>,
    result: TResult<TResult<T, TCodecError>, TRpcError>
  ): TResult<T, TCodecError> => {
    if (result.ok) {
      return result.value;
    }
    if (client === current && result.error.kind !== 'disposed') {
      current.dispose();
      client = null;
    }
    return err(codecErrorOf(result.error));
  };

  return {
    async createKeys(password, signal) {
      const current = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      const sent = transferable(password);
      password.fill(0);
      return settle(
        current,
        await current.call('createKeys', { password: sent }, { signal, transfer: [sent.buffer] })
      );
    },
    async changePassword(keys, { current, next }, signal) {
      const worker = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      const sent = { current: handOverSlotSecret(current), next: handOver(next) };
      return settle(
        worker,
        await worker.call(
          'changePassword',
          { keys, current: sent.current.secret, next: sent.next },
          { signal, transfer: [sent.current.transfer, sent.next.buffer] }
        )
      );
    },
    async rotateKey(keys, password, signal) {
      const worker = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      const sent = handOver(password);
      return settle(
        worker,
        await worker.call(
          'rotateKey',
          { keys, password: sent },
          { signal, transfer: [sent.buffer] }
        )
      );
    },
    async addPasskey(keys, { current, credentialId, prfOutput }, signal) {
      const worker = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      const sent = { current: handOverSlotSecret(current), prfOutput: handOver(prfOutput) };
      return settle(
        worker,
        await worker.call(
          'addPasskey',
          { keys, current: sent.current.secret, credentialId, prfOutput: sent.prfOutput },
          { signal, transfer: [sent.current.transfer, sent.prfOutput.buffer] }
        )
      );
    },
    async addRecoveryKey(keys, { current, recoveryKey }, signal) {
      const worker = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      const sent = { current: handOverSlotSecret(current), recoveryKey: handOver(recoveryKey) };
      return settle(
        worker,
        await worker.call(
          'addRecoveryKey',
          { keys, current: sent.current.secret, recoveryKey: sent.recoveryKey },
          { signal, transfer: [sent.current.transfer, sent.recoveryKey.buffer] }
        )
      );
    },
    async open(file, unlock, signal) {
      const current = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      const sentFile = transferable(file);
      const secret = handOverSecret(unlock);
      return settle(
        current,
        await current.call(
          'open',
          { file: sentFile, unlock: secret.unlock },
          { signal, transfer: [sentFile.buffer, ...secret.transfer] }
        )
      );
    },
    async seal(document, manifest, context, signal) {
      const current = (client ??= createRpcClient<TVaultCodecContract>(spawn()));
      return settle(
        current,
        await current.call('seal', { document, manifest, context }, { signal })
      );
    },
    dispose() {
      client?.dispose();
      client = null;
    },
  };
}
