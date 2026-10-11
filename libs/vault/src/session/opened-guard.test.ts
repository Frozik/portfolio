import { assert } from '@frozik/utils/assert/assert';

import { createInThreadCodec } from '../codec/in-thread-codec';
import { toHex } from '../crypto/bytes';
import { sampleVaultDocument } from '../testing/sample-vault';
import { createSeededRandom } from '../testing/seeded-random';
import { aManifest, aVault, TEST_PASSWORD } from '../testing/vault-file-fixtures';
import { openedGuard } from './opened-guard';

const SIGNAL = new AbortController().signal;

async function openedAtRevision(revision: number) {
  const { context, dependencies } = await aVault();
  const codec = createInThreadCodec(dependencies);
  const sealed = await codec.seal(
    sampleVaultDocument(createSeededRandom(3)),
    aManifest(),
    { ...context, revision },
    SIGNAL
  );
  assert(sealed.ok);
  const opened = await codec.open(
    sealed.value,
    { kind: 'password', password: TEST_PASSWORD },
    SIGNAL
  );
  assert(opened.ok);
  return opened.value;
}

describe('openedGuard', () => {
  it('starts a device that remembers nothing from the file it opened', async () => {
    const opened = await openedAtRevision(4);

    expect(openedGuard(opened, 'file-hash', null)).toEqual({
      vaultId: toHex(opened.header.vaultId),
      keyId: toHex(opened.header.keyId),
      maxSeenRevision: 4,
      maxSeenKeyslotsEpoch: 0,
      hashAtMaxSeen: 'file-hash',
      retiredKeyIds: [],
    });
  });

  it('keeps what the device saw when the file it opened is older', async () => {
    const opened = await openedAtRevision(4);

    const guard = openedGuard(opened, 'old-file-hash', {
      maxSeenRevision: 9,
      maxSeenKeyslotsEpoch: 2,
      cloudKeyslotsEpoch: 2,
      hashAtMaxSeen: 'seen-hash',
      retiredKeyIds: [],
      keyId: toHex(opened.header.keyId),
      lastSyncedRev: null,
      lastHlc: null,
    });

    expect(guard.maxSeenRevision).toBe(9);
    expect(guard.maxSeenKeyslotsEpoch).toBe(2);
    expect(guard.hashAtMaxSeen).toBe('seen-hash');
  });
});
