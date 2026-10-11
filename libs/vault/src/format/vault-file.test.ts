import { assert } from '@frozik/utils/assert/assert';

import { concatBytes, toHex, utf8 } from '../crypto/bytes';
import { encodePassword } from '../crypto/password-normalization';
import { aFileContent, aManifest, aVault, TEST_PASSWORD } from '../testing/vault-file-fixtures';
import { decodeHeader } from './header';
import { openVaultFile } from './open-vault';
import { sealVaultFile } from './seal-vault';

async function sealedVault(seed = 1) {
  const vault = await aVault(seed);
  const file = await sealVaultFile(aFileContent(), vault.context, vault.dependencies.random);
  return { ...vault, file };
}

function headerLength(file: Uint8Array<ArrayBuffer>): number {
  const decoded = decodeHeader(file);
  assert(decoded.ok);
  return decoded.value.headerBytes.length;
}

describe('vault file', () => {
  it('opens with the password to the manifest and files it was sealed with', async () => {
    const { file, dependencies } = await sealedVault();

    const opened = await openVaultFile(
      file,
      { kind: 'password', password: TEST_PASSWORD },
      dependencies.argon2
    );

    assert(opened.ok);
    expect(opened.value.manifest).toEqual(aManifest());
    expect([...opened.value.entries.keys()].sort()).toEqual([
      'assets/scan',
      'cards/one.json',
      'vault.json',
    ]);
    expect(opened.value.entries.get('cards/one.json')).toEqual(utf8('{"title":"Bank"}'));
    expect(opened.value.access).toBe('read-write');
  });

  it('says "wrong password" for any other password', async () => {
    const { file, dependencies } = await sealedVault();

    expect(
      await openVaultFile(
        file,
        { kind: 'password', password: encodePassword('Correct horse battery staple') },
        dependencies.argon2
      )
    ).toEqual({ ok: false, error: { kind: 'wrong-password' } });
  });

  it('re-opens for an unlocked session without a KDF, and tells a rotated key from damage', async () => {
    const { file, keys, dependencies } = await sealedVault();
    const callsBefore = dependencies.argon2.calls;

    const reopened = await openVaultFile(
      file,
      { kind: 'session', dek: keys.dek, keyId: keys.keyId },
      dependencies.argon2
    );
    const rotated = await openVaultFile(
      file,
      { kind: 'session', dek: keys.dek, keyId: new Uint8Array(16) },
      dependencies.argon2
    );

    expect(reopened.ok).toBe(true);
    expect(dependencies.argon2.calls).toBe(callsBefore);
    expect(rotated).toEqual({ ok: false, error: { kind: 'key-rotated' } });
  });

  it('never seals the same content twice under the same salt or to the same bytes', async () => {
    const { context, dependencies } = await aVault();
    const files = await Promise.all(
      Array.from({ length: 5 }, () => sealVaultFile(aFileContent(), context, dependencies.random))
    );

    const salts = files.map(file => {
      const decoded = decodeHeader(file);
      assert(decoded.ok);
      return toHex(decoded.value.header.saveSalt);
    });
    expect(new Set(salts).size).toBe(files.length);
    expect(new Set(files.map(toHex)).size).toBe(files.length);
  });

  it('refuses any single flipped byte, as damage once past the header', async () => {
    const { file, dependencies } = await sealedVault();
    const payloadStart = headerLength(file);

    for (let index = 0; index < file.length; index += 1) {
      const mutated = file.slice();
      mutated[index] = (mutated[index] ?? 0) ^ 0x01;
      const opened = await openVaultFile(
        mutated,
        { kind: 'password', password: TEST_PASSWORD },
        dependencies.argon2
      );
      expect(opened.ok, `byte ${index}`).toBe(false);
      if (index >= payloadStart) {
        expect(opened).toEqual({ ok: false, error: { kind: 'corrupted' } });
      }
    }
  });

  it('refuses a truncated or extended file as damaged', async () => {
    const { file, dependencies } = await sealedVault();
    const unlock = { kind: 'password', password: TEST_PASSWORD } as const;
    const corrupted = { ok: false, error: { kind: 'corrupted' } };

    expect(
      await openVaultFile(file.slice(0, file.length - 1), unlock, dependencies.argon2)
    ).toEqual(corrupted);
    expect(
      await openVaultFile(file.slice(0, headerLength(file)), unlock, dependencies.argon2)
    ).toEqual(corrupted);
    expect(
      await openVaultFile(concatBytes(file, new Uint8Array(17)), unlock, dependencies.argon2)
    ).toEqual(corrupted);
  });

  it('calls a slot whose key check does not match tampered, not a wrong password', async () => {
    const { context, dependencies } = await aVault();
    const tampered = await sealVaultFile(
      aFileContent(),
      { ...context, keyCheck: new Uint8Array(32) },
      dependencies.random
    );

    expect(
      await openVaultFile(
        tampered,
        { kind: 'password', password: TEST_PASSWORD },
        dependencies.argon2
      )
    ).toEqual({
      ok: false,
      error: { kind: 'slot-tampered' },
    });
  });

  it('opens a newer document schema read-only', async () => {
    const { context, dependencies } = await aVault();
    const file = await sealVaultFile(
      aFileContent({ manifest: aManifest({ schemaVersion: 99 }) }),
      context,
      dependencies.random
    );

    const opened = await openVaultFile(
      file,
      { kind: 'password', password: TEST_PASSWORD },
      dependencies.argon2
    );

    expect(opened.ok && opened.value.access).toBe('read-only');
  });

  it('keeps unknown manifest keys, unknown files and skippable header records of a newer writer', async () => {
    const { context, dependencies } = await aVault();
    const preserved = [{ type: 0x7f, skippable: true, value: utf8('future') }];
    const content = aFileContent({
      manifest: { ...aManifest(), futureKey: { nested: true } },
      entries: [
        ...aFileContent().entries,
        { path: 'future/thing.bin', bytes: utf8('?'), compress: false },
      ],
    });
    const file = await sealVaultFile(
      content,
      { ...context, preserved, movedTo: 'webdav:https://dav.example/vault.pwv' },
      dependencies.random
    );

    const opened = await openVaultFile(
      file,
      { kind: 'password', password: TEST_PASSWORD },
      dependencies.argon2
    );

    assert(opened.ok);
    expect(opened.value.manifest).toMatchObject({ futureKey: { nested: true } });
    expect(opened.value.entries.get('future/thing.bin')).toEqual(utf8('?'));
    expect(opened.value.header.preserved).toEqual(preserved);
    expect(opened.value.header.movedTo).toBe('webdav:https://dav.example/vault.pwv');
  });

  it('is not a vault at all when the magic is wrong', async () => {
    const { dependencies } = await aVault();

    expect(
      await openVaultFile(
        utf8('PK\u0003\u0004 a zip, not a vault'),
        { kind: 'password', password: TEST_PASSWORD },
        dependencies.argon2
      )
    ).toEqual({
      ok: false,
      error: { kind: 'unsupported-format' },
    });
  });
});
