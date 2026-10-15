import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { err } from '@frozik/utils/result/result';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { createMemoryDevice } from '@frozik/vault/testing/memory-device-stores';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { when } from 'mobx';

import { createFakeSessionClock } from '../../testing/fake-session-clock';
import { LOCAL_COPY_PATH } from '../domain/local-copy';
import { PERIODIC_BACKUP_MS, VaultBackups } from './VaultBackups';

const VAULT = 'v1' as TVaultKey;
const SIGNAL = new AbortController().signal;
let databases = 0;

async function aBackups() {
  databases += 1;
  const random = createSeededRandom(databases);
  const { snapshots } = createMemoryDevice()(random);
  const localCopy = createMemoryProvider();
  await localCopy.write(LOCAL_COPY_PATH, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
  const time = createFakeSessionClock();
  const backups = new VaultBackups({
    vaultKey: VAULT,
    snapshots,
    localCopy,
    open: () => Promise.resolve(err({ kind: 'corrupted' })),
    clock: time.clock,
    keep: () => 10,
    transact: () => null,
    signal: SIGNAL,
  });
  const reasons = async () => {
    await backups.refresh();
    return backups.entries.value?.map(entry => entry.reason) ?? [];
  };
  return { backups, time, reasons };
}

describe('VaultBackups', () => {
  it('keeps the version before an edit, then at most once an hour of edits', async () => {
    const { backups, time, reasons } = await aBackups();

    backups.noteEdit();
    await vi.waitFor(async () => expect(await reasons()).toEqual(['periodic']));
    backups.noteEdit();
    time.advance(PERIODIC_BACKUP_MS - 1);
    backups.noteEdit();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(await reasons()).toEqual(['periodic']);

    time.advance(1);
    backups.noteEdit();

    await vi.waitFor(async () => expect(await reasons()).toEqual(['periodic', 'periodic']));
  });

  it('lists what it keeps once asked, and keeps the list fresh after that', async () => {
    const { backups } = await aBackups();
    await backups.refresh();

    await backups.keep('before-sync');

    await when(() => backups.entries.value?.length === 1);
    expect(backups.entries.value?.[0]?.reason).toBe('before-sync');
  });
});
