import { assert } from '@frozik/utils/assert/assert';
import { utf8 } from '@frozik/vault/crypto/bytes';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { CHROME_CSV, SAFEINCLOUD_XML } from '@frozik/vault/testing/import-fixtures';
import { aSafeInCloudDb } from '@frozik/vault/testing/safeincloud-db-fixture';
import { when } from 'mobx';

import type { VaultSession } from '../../session/application/VaultSession';
import { aDevice, KEEPASS_KEY_FILE, KEEPASS_PASSWORD } from '../../testing/fake-device';

const PASSWORD = 'correct horse battery staple';
const EXPORT_PASSWORD = 'a separate export password';

async function unlocked(name: string, device = aDevice()) {
  const store = device.startStore();
  store.create(name, PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(session !== null);
  return { device, store, session };
}

function titlesOf(session: VaultSession): readonly string[] {
  return [...session.document.cards.values()].map(card => card.title).sort();
}

describe('import and export', () => {
  it('imports a browser CSV after a preview, skipping what the vault already has', async () => {
    const { session } = await unlocked('Mine');
    const flow = session.flows.importInto(key => key);

    await flow.choose(utf8(CHROME_CSV));
    expect(flow.step).toMatchObject({ kind: 'preview', preview: { cards: 2, duplicates: 0 } });
    await flow.confirm();
    expect(flow.step).toEqual({
      kind: 'done',
      outcome: { added: 2, replaced: 0, skipped: 0, filesDropped: 0 },
    });

    flow.reset();
    await flow.choose(utf8(CHROME_CSV));
    expect(flow.step).toMatchObject({ kind: 'preview', preview: { duplicates: 2 } });
    await flow.confirm();
    expect(titlesOf(session)).toEqual(['Bank, personal', 'github.com']);
  });

  it('seals a copy under its own password that another device imports as new cards', async () => {
    const source = await unlocked('Family');
    const importing = source.session.flows.importInto(key => key);
    await importing.choose(utf8(CHROME_CSV));
    await importing.confirm();

    const exporting = source.session.flows.exportOf();
    exporting.setPassword(EXPORT_PASSWORD);
    exporting.setConfirmation(EXPORT_PASSWORD);
    await exporting.prepare();
    await exporting.save();
    const [copy] = source.device.saved;
    assert(copy !== undefined);

    expect(copy.name).toMatch(/^Family \d{4}-\d{2}-\d{2}\.pwv$/);
    expect(vaultKeyOf(copy.bytes)).not.toBe(source.session.vaultKey);

    const other = await unlocked('Other', aDevice({ seed: 11 }));
    const flow = other.session.flows.importInto(key => key);
    await flow.choose(copy.bytes);
    expect(flow.step.kind).toBe('vault-password');
    flow.setVaultPassword(PASSWORD);
    await flow.openVaultFile();
    expect(flow.step).toMatchObject({ kind: 'vault-password', failure: 'wrong-password' });
    flow.setVaultPassword(EXPORT_PASSWORD);
    await flow.openVaultFile();
    await flow.confirm();

    expect(titlesOf(other.session)).toEqual(titlesOf(source.session));
    expect(
      [...other.session.document.cards.keys()].some(id => source.session.document.cards.has(id))
    ).toBe(false);
  });

  it('writes the open formats only for the master password and a confirmation', async () => {
    const { device, session } = await unlocked('Mine');
    const exporting = session.flows.exportOf();
    exporting.setFormat('csv');
    exporting.setPassword(PASSWORD);

    expect(exporting.problem).toBe('not-acknowledged');
    exporting.setAcknowledged(true);
    exporting.setPassword('not the master password');
    await exporting.prepare();
    expect(exporting.step).toEqual({ kind: 'editing', failure: 'wrong-password' });

    exporting.setPassword(PASSWORD);
    await exporting.prepare();
    await exporting.save();
    expect(device.saved.map(file => file.mime)).toEqual(['text/csv']);
    expect(exporting.password).toBe('');
  });

  it('exports CXF behind the master password that another manager, here another vault, reads back', async () => {
    const source = await unlocked('Family');
    const importing = source.session.flows.importInto(key => key);
    await importing.choose(utf8(CHROME_CSV));
    await importing.confirm();

    const exporting = source.session.flows.exportOf();
    exporting.setFormat('cxf');
    exporting.setPassword(PASSWORD);
    exporting.setAcknowledged(true);
    await exporting.prepare();
    await exporting.save();
    const [file] = source.device.saved;
    assert(file !== undefined);
    expect(file.name).toMatch(/^Family \d{4}-\d{2}-\d{2}\.cxf\.zip$/);

    const other = await unlocked('Other', aDevice({ seed: 11 }));
    const flow = other.session.flows.importInto(key => key);
    await flow.choose(file.bytes);
    expect(flow.step).toMatchObject({ kind: 'preview', preview: { cards: 2 } });
    await flow.confirm();

    expect(titlesOf(other.session)).toEqual(titlesOf(source.session));
  });

  it('opens a KeePass file with its own password before the preview', async () => {
    const { session } = await unlocked('Mine');
    const flow = session.flows.importInto(key => key);
    const keePassFile = Uint8Array.of(0x03, 0xd9, 0xa2, 0x9a, 0x67, 0xfb, 0x4b, 0xb5, 0x01);

    await flow.choose(keePassFile);
    expect(flow.step).toMatchObject({ kind: 'vault-password', source: { format: 'kdbx' } });
    flow.setVaultPassword('not it');
    await flow.openVaultFile();
    expect(flow.step).toMatchObject({ kind: 'vault-password', failure: 'wrong-password' });
    flow.setVaultPassword(KEEPASS_PASSWORD);
    await flow.openVaultFile();
    await flow.confirm();

    expect(titlesOf(session)).toEqual(['From KeePass']);
  });

  it('opens a KeePass file with its key file alone, the password left empty', async () => {
    const { session } = await unlocked('Mine');
    const flow = session.flows.importInto(key => key);
    await flow.choose(Uint8Array.of(0x03, 0xd9, 0xa2, 0x9a, 0x67, 0xfb, 0x4b, 0xb5, 0x01));
    expect(flow.canOpen).toBe(false);

    flow.setKeyFile({ name: 'database.keyx', bytes: KEEPASS_KEY_FILE });
    expect(flow.canOpen).toBe(true);
    await flow.openVaultFile();
    await flow.confirm();

    expect(titlesOf(session)).toEqual(['From KeePass']);
    expect(flow.keyFile).toBeNull();
  });

  it('opens a SafeInCloud database with its own password before the preview', async () => {
    const { session } = await unlocked('Mine');
    const flow = session.flows.importInto(key => key);

    await flow.choose(await aSafeInCloudDb(SAFEINCLOUD_XML, 'sic password'));
    expect(flow.step).toMatchObject({ kind: 'vault-password', source: { format: 'safeincloud' } });
    flow.setVaultPassword('not it');
    await flow.openVaultFile();
    expect(flow.step).toMatchObject({ kind: 'vault-password', failure: 'wrong-password' });
    flow.setVaultPassword('sic password');
    await flow.openVaultFile();
    await flow.confirm();

    expect(titlesOf(session)).toEqual(['Example mail', 'Travel card']);
  });

  it('writes nothing when the import is cancelled while its files are being sealed', async () => {
    const { session } = await unlocked('Mine');
    const flow = session.flows.importInto(key => key);
    await flow.choose(utf8(CHROME_CSV));

    const confirming = flow.confirm();
    flow.reset();
    await confirming;

    expect(flow.step).toEqual({ kind: 'choosing' });
    expect(titlesOf(session)).toEqual([]);
  });
});
