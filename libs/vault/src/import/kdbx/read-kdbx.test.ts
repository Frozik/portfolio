// @vitest-environment node
import { assert } from '@frozik/utils/assert/assert';
import { Kdbx, KdbxCredentials, ProtectedValue } from 'kdbxweb';
import * as kdbxweb from 'kdbxweb';

import { utf8 } from '../../crypto/bytes';
import { referenceNodeArgon2 } from '../../testing/reference-node-argon2';
import type { IImportedCard } from '../imported-card';
import { readImportFile } from '../read-import-file';
import { HASH_WASM_KDBX_ARGON2 } from './adapters/kdbx-argon2-hash-wasm';
import { nodeKdbxArgon2 } from './adapters/kdbx-argon2-node';
import { readKdbx } from './read-kdbx';

const PASSWORD = 'keepass master';
const KDF_MEMORY_BYTES = 1024 * 1024;

/** A KeePass 2 database as KeePassXC would write one, with a cheap Argon2 for the test. */
async function aKeePassFile(): Promise<Uint8Array<ArrayBuffer>> {
  kdbxweb.CryptoEngine.setArgon2Impl(HASH_WASM_KDBX_ARGON2);
  const database = Kdbx.create(new KdbxCredentials(ProtectedValue.fromString(PASSWORD)), 'Mine');
  database.header.kdfParameters?.set(
    'M',
    kdbxweb.VarDictionary.ValueType.UInt64,
    kdbxweb.Int64.from(KDF_MEMORY_BYTES)
  );
  const root = database.getDefaultGroup();
  const work = database.createGroup(root, 'Work');

  const github = database.createEntry(work);
  github.fields.set('Title', 'GitHub');
  github.fields.set('UserName', 'jane');
  github.fields.set('Password', ProtectedValue.fromString('s3cret'));
  github.fields.set('URL', 'https://github.com');
  github.fields.set('Recovery PIN', ProtectedValue.fromString('4321'));
  github.fields.set('otp', 'otpauth://totp/GitHub:jane?secret=JBSWY3DPEHPK3PXP&issuer=GitHub');
  github.tags = ['dev'];
  github.binaries.set('backup-codes.txt', await database.createBinary(utf8('one two').buffer));

  const passport = database.createEntry(root);
  passport.fields.set('Title', 'Passport');
  passport.fields.set('Notes', 'In the safe');
  passport.fields.set('TimeOtp-Secret-Base32', 'JBSWY3DPEHPK3PXP');
  passport.times.expires = true;
  passport.times.expiryTime = passport.times.creationTime;

  database.createRecycleBin();
  const trashed = database.createEntry(root);
  trashed.fields.set('Title', 'Old');
  database.remove(trashed);

  return new Uint8Array(await database.save());
}

function fieldsOf(card: IImportedCard | undefined): Readonly<Record<string, string>> {
  return Object.fromEntries(
    (card?.tabs ?? []).flatMap(tab =>
      tab.fields.map(field => [
        field.label.kind === 'key' ? field.label.key : field.label.text,
        field.value.cardinality === 'single' ? field.value.value : field.value.values.join(','),
      ])
    )
  );
}

describe('KeePass import', () => {
  it('is told by its signature and asks for the file’s password', async () => {
    expect(readImportFile(await aKeePassFile())).toEqual({
      ok: true,
      value: { kind: 'kdbx-file' },
    });
  });

  it('reads every entry outside the recycle bin with its group, tags, fields, codes and attachments', async () => {
    const read = await readKdbx(
      await aKeePassFile(),
      { password: PASSWORD, keyFile: null },
      HASH_WASM_KDBX_ARGON2
    );

    assert(read.ok);
    const { cards, assets } = read.value;
    expect(cards.map(card => card.title).sort()).toEqual(['GitHub', 'Passport']);
    const github = cards.find(card => card.title === 'GitHub');
    expect(github?.templateId).toBe('internet-account');
    expect(github?.groups).toEqual(['Work', 'dev']);
    expect(fieldsOf(github)).toMatchObject({
      'field.login': 'jane',
      'field.password': 's3cret',
      'field.websites': 'https://github.com',
      'Recovery PIN': '4321',
      'field.oneTimeCode': 'otpauth://totp/GitHub:jane?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
    });
    expect(
      github?.tabs.flatMap(tab => tab.fields).find(field => field.label.kind === 'text')?.sensitive
    ).toBe(true);
    expect(assets.map(({ asset, bytes }) => [asset.name, bytes])).toEqual([
      ['backup-codes.txt', utf8('one two')],
    ]);
    const passport = cards.find(card => card.title === 'Passport');
    expect(passport?.templateId).toBe('note');
    expect(fieldsOf(passport)['field.notes']).toBe('In the safe');
    expect(fieldsOf(passport)['field.oneTimeCode']).toMatch(
      /^otpauth:\/\/totp\/.*secret=JBSWY3DPEHPK3PXP/
    );
    expect(fieldsOf(passport)['field.expiresOn']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens the same database through a native Argon2, as a phone does', async () => {
    const read = await readKdbx(
      await aKeePassFile(),
      { password: PASSWORD, keyFile: null },
      nodeKdbxArgon2(referenceNodeArgon2)
    );

    assert(read.ok);
    expect(read.value.cards.map(card => card.title).sort()).toEqual(['GitHub', 'Passport']);
  });

  it('says the password is wrong, and that a file which is not KeePass cannot be read', async () => {
    const file = await aKeePassFile();

    expect(
      await readKdbx(file, { password: 'nope', keyFile: null }, HASH_WASM_KDBX_ARGON2)
    ).toEqual({
      ok: false,
      error: 'wrong-password',
    });
    expect(
      await readKdbx(
        file.slice(0, 40),
        { password: PASSWORD, keyFile: null },
        HASH_WASM_KDBX_ARGON2
      )
    ).toEqual({
      ok: false,
      error: 'unreadable',
    });
  });

  it('opens a database locked by a key file alone, and refuses it without the key file', async () => {
    kdbxweb.CryptoEngine.setArgon2Impl(HASH_WASM_KDBX_ARGON2);
    const keyFile = await KdbxCredentials.createRandomKeyFile();
    const database = Kdbx.create(new KdbxCredentials(null, keyFile), 'Keyed');
    database.header.kdfParameters?.set(
      'M',
      kdbxweb.VarDictionary.ValueType.UInt64,
      kdbxweb.Int64.from(KDF_MEMORY_BYTES)
    );
    database.createEntry(database.getDefaultGroup()).fields.set('Title', 'Keyed entry');
    const file = new Uint8Array(await database.save());

    const opened = await readKdbx(
      file,
      { password: '', keyFile: Uint8Array.from(keyFile) },
      HASH_WASM_KDBX_ARGON2
    );
    const refused = await readKdbx(file, { password: '', keyFile: null }, HASH_WASM_KDBX_ARGON2);

    expect(opened.ok && opened.value.cards.map(card => card.title)).toEqual(['Keyed entry']);
    expect(refused.ok).toBe(false);
  });
});
