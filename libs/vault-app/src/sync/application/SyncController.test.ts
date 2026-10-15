import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import type { TSyncStop } from '@frozik/vault/sync/sync-state';
import { initialSyncState } from '@frozik/vault/sync/sync-state';
import { aManifest, aVault } from '@frozik/vault/testing/vault-file-fixtures';
import { when } from 'mobx';

import { SyncController } from './SyncController';

const PATH = storagePath('vault.pwv');
const SIGNAL = new AbortController().signal;

describe('SyncController', () => {
  it('reports once that its engine stopped, so the session can stop pretending to save', async () => {
    const { keys, dependencies } = await aVault();
    const provider = createMemoryProvider();
    await provider.write(PATH, Uint8Array.of(1, 2, 3), { kind: 'absent' }, SIGNAL);
    const stops: TSyncStop[] = [];
    const document = emptyVaultDocument('Home', { wallMs: 1, counter: 0, node: 'tab' });
    const controller = new SyncController(
      {
        provider,
        path: PATH,
        codec: createInThreadCodec(dependencies),
        random: dependencies.random,
        keys,
        manifest: aManifest(),
        document: () => document,
        merge: () => false,
        saveGuard: () => Promise.resolve(),
        adoptKeys: () => undefined,
        keysShared: () => undefined,
        wait: () => Promise.resolve(true),
      },
      initialSyncState(
        {
          vaultId: 'vault',
          keyId: 'key',
          maxSeenRevision: 0,
          maxSeenKeyslotsEpoch: 0,
          hashAtMaxSeen: null,
          retiredKeyIds: [],
        },
        null
      ),
      { onStopped: stop => stops.push(stop) }
    );

    controller.dispatch({ kind: 'pull-requested' });
    await when(() => controller.state.phase.kind === 'stopped');
    controller.dispatch({ kind: 'pull-requested' });

    expect(stops).toEqual([{ kind: 'corrupted' }]);
  });
});
