import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { err, ok } from '@frozik/utils/result/result';
import { when } from 'mobx';

import type { IGoogleDriveAuth, TGoogleAuthFailure } from '../domain/ports/google-drive';
import { GoogleDriveConnectForm } from './GoogleDriveConnectForm';

const SIGNAL = new AbortController().signal;

function aDrive(failure: TGoogleAuthFailure | null = null) {
  const opened: TDriveSpace[] = [];
  const storages = new Map<TDriveSpace, ReturnType<typeof createMemoryProvider>>();
  const authorize = vi.fn(() => Promise.resolve(failure === null ? ok(undefined) : err(failure)));
  const openDrive = (space: TDriveSpace) => {
    opened.push(space);
    const storage = storages.get(space) ?? createMemoryProvider();
    storages.set(space, storage);
    const auth: IGoogleDriveAuth = {
      prepare: () => Promise.resolve(true),
      authorize,
      token: () => Promise.resolve(ok('token')),
      invalidate: () => undefined,
    };
    return { auth, storage };
  };
  return { openDrive, opened, authorize, storageOf: (space: TDriveSpace) => storages.get(space) };
}

describe('Google Drive connect form', () => {
  it('signs in inside the click and lists the vaults already in the Vault folder', async () => {
    const drive = aDrive();
    const form = new GoogleDriveConnectForm(drive.openDrive);
    await drive
      .storageOf('my-drive')
      ?.write(storagePath('Vault/Family.pwv'), Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
    await drive
      .storageOf('my-drive')
      ?.write(storagePath('Vault/notes.txt'), Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
    await when(() => form.ready);

    const connecting = form.connect();
    expect(drive.authorize).toHaveBeenCalledOnce();
    await connecting;

    expect(form.check).toMatchObject({
      kind: 'found',
      vaults: [{ path: 'Vault/Family.pwv' }],
    });
  });

  it('asks for the other space’s permission only once that space is chosen', async () => {
    const drive = aDrive();
    const form = new GoogleDriveConnectForm(drive.openDrive);

    form.setSpace('app-data');
    await when(() => form.ready);

    expect(drive.opened).toEqual(['my-drive', 'app-data']);
    expect(form.space).toBe('app-data');
  });

  it('says why the sign-in did not happen', async () => {
    const drive = aDrive('popup-blocked');
    const form = new GoogleDriveConnectForm(drive.openDrive);
    await when(() => form.ready);

    await form.connect();

    expect(form.check).toEqual({
      kind: 'failed',
      failure: { kind: 'auth', reason: 'popup-blocked' },
    });
  });
});
