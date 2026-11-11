import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

const DAY_MS = 24 * 60 * 60 * 1000;

async function openVault() {
  const device = aDevice();
  const store = device.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const session = store.session;
  if (session === null) {
    throw new Error('the vault did not open');
  }
  const backups = session.flows.backupFolderOf();
  if (backups === null) {
    throw new Error('no backup folder on this device');
  }
  return { device, session, backups };
}

describe('the backup folder', () => {
  it('keeps the vault file itself, named after the vault and the minute', async () => {
    const { device, session, backups } = await openVault();

    await backups.backUpNow();

    const [[name, bytes] = ['', new Uint8Array()]] = [...device.backupFolder.files()];
    expect({
      name: /^Family \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.pwv$/.test(name),
      vault: vaultKeyOf(bytes as Uint8Array<ArrayBuffer>),
      listed: backups.listing.kind === 'listed' ? backups.listing.files.map(file => file.name) : [],
      made: backups.making,
      last: backups.lastBackupAt,
    }).toEqual({
      name: true,
      vault: session.vaultKey,
      listed: [name],
      made: { kind: 'made', name },
      last: device.time.clock.now(),
    });
  });

  it('makes a copy at unlock once the chosen days have passed, and never when told so', async () => {
    const { device, backups } = await openVault();

    await backups.backUpIfDue();
    const first = device.backupFolder.files().size;
    device.time.advance(DAY_MS);
    await backups.backUpIfDue();
    const dayLater = device.backupFolder.files().size;
    device.time.advance(7 * DAY_MS);
    await backups.backUpIfDue();
    const weekLater = device.backupFolder.files().size;
    backups.setInterval(null);
    device.time.advance(30 * DAY_MS);
    await backups.backUpIfDue();

    expect({ first, dayLater, weekLater, never: device.backupFolder.files().size }).toEqual({
      first: 1,
      dayLater: 1,
      weekLater: 2,
      never: 2,
    });
  });

  it('shares a copy with another app and deletes the one no longer wanted', async () => {
    const { device, backups } = await openVault();
    await backups.backUpNow();
    const [name = ''] = [...device.backupFolder.files().keys()];

    await backups.share(name);
    await backups.remove(name);

    expect({
      shared: device.saved.map(file => ({ name: file.name, mime: file.mime })),
      left: device.backupFolder.files().size,
      listed: backups.listing,
    }).toEqual({
      shared: [{ name, mime: 'application/octet-stream' }],
      left: 0,
      listed: { kind: 'listed', files: [] },
    });
  });
});
