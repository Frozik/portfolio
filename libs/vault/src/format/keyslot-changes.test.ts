import { assert } from '@frozik/utils/assert/assert';

import { ARGON2_FLOOR } from '../crypto/kdf-port';
import { encodePassword } from '../crypto/password-normalization';
import { generateRecoveryKey } from '../crypto/recovery-key';
import { aFileContent, aVault, TEST_PASSWORD } from '../testing/vault-file-fixtures';
import {
  withNewKey,
  withNewPassword,
  withoutPasskey,
  withPasskey,
  withRecoveryKey,
} from './keyslot-changes';
import { openVaultFile } from './open-vault';
import { sealVaultFile } from './seal-vault';

const NEW_PASSWORD = encodePassword('a brand new master password');
const PASSWORD = { kind: 'password', password: TEST_PASSWORD } as const;

describe('changing the master password', () => {
  it('opens the vault with the new password only, under the same key, a slot epoch later', async () => {
    const { keys, context, dependencies } = await aVault();
    const changed = await withNewPassword(
      keys,
      { current: PASSWORD, next: NEW_PASSWORD, params: ARGON2_FLOOR },
      dependencies
    );
    assert(changed.ok);
    const file = await sealVaultFile(
      aFileContent(),
      { ...context, ...changed.value },
      dependencies.random
    );

    const withNew = await openVaultFile(
      file,
      { kind: 'password', password: NEW_PASSWORD },
      dependencies.argon2
    );
    const withOld = await openVaultFile(
      file,
      { kind: 'password', password: TEST_PASSWORD },
      dependencies.argon2
    );

    assert(withNew.ok);
    expect(withNew.value.keys.keyId).toEqual(keys.keyId);
    expect(withNew.value.header.keyslotsEpoch).toBe(keys.keyslotsEpoch + 1);
    expect(withOld).toEqual({ ok: false, error: { kind: 'wrong-password' } });
  });

  it('refuses without the current password and leaves the keys alone', async () => {
    const { keys, dependencies } = await aVault();

    expect(
      await withNewPassword(
        keys,
        {
          current: { kind: 'password', password: NEW_PASSWORD },
          next: NEW_PASSWORD,
          params: ARGON2_FLOOR,
        },
        dependencies
      )
    ).toEqual({ ok: false, error: 'wrong-password' });
  });

  it('keeps the slots that are not the password', async () => {
    const { keys, dependencies } = await aVault();
    const recovery = { ...keys.keyslots[0], kind: 'recovery' as const };
    const changed = await withNewPassword(
      { ...keys, keyslots: [keys.keyslots[0], recovery] },
      { current: PASSWORD, next: NEW_PASSWORD, params: ARGON2_FLOOR },
      dependencies
    );

    assert(changed.ok);
    expect(changed.value.keyslots.map(slot => slot.kind)).toEqual(['password', 'recovery']);
    expect(changed.value.keyslots[1]).toBe(recovery);
  });
});

describe('the recovery key', () => {
  it('opens the vault once added, and the password still does', async () => {
    const { keys, context, dependencies } = await aVault();
    const recoveryKey = generateRecoveryKey(dependencies.random);
    const added = await withRecoveryKey(
      keys,
      { current: PASSWORD, recoveryKey: recoveryKey.slice() },
      dependencies
    );
    assert(added.ok);
    const file = await sealVaultFile(
      aFileContent(),
      { ...context, ...added.value },
      dependencies.random
    );

    const byKey = await openVaultFile(file, { kind: 'recovery', recoveryKey }, dependencies.argon2);
    const byPassword = await openVaultFile(
      file,
      { kind: 'password', password: TEST_PASSWORD },
      dependencies.argon2
    );

    expect(byKey.ok && byPassword.ok).toBe(true);
    expect(added.value.keyslotsEpoch).toBe(keys.keyslotsEpoch + 1);
  });

  it('replaces the previous key, and sets a new password after a recovery', async () => {
    const { keys, context, dependencies } = await aVault();
    const first = generateRecoveryKey(dependencies.random);
    const second = generateRecoveryKey(dependencies.random);
    const once = await withRecoveryKey(
      keys,
      { current: PASSWORD, recoveryKey: first },
      dependencies
    );
    assert(once.ok);
    const twice = await withRecoveryKey(
      once.value,
      { current: PASSWORD, recoveryKey: second },
      dependencies
    );
    assert(twice.ok);
    const recovered = await withNewPassword(
      twice.value,
      {
        current: { kind: 'recovery', recoveryKey: second },
        next: NEW_PASSWORD,
        params: ARGON2_FLOOR,
      },
      dependencies
    );
    assert(recovered.ok);
    const file = await sealVaultFile(
      aFileContent(),
      { ...context, ...recovered.value },
      dependencies.random
    );

    expect(twice.value.keyslots.filter(slot => slot.kind === 'recovery')).toHaveLength(1);
    expect(
      (await openVaultFile(file, { kind: 'recovery', recoveryKey: first }, dependencies.argon2)).ok
    ).toBe(false);
    expect(
      (await openVaultFile(file, { kind: 'password', password: NEW_PASSWORD }, dependencies.argon2))
        .ok
    ).toBe(true);
  });
});

describe('rotating the key', () => {
  it('seals with a new key the password opens, which the old key no longer does', async () => {
    const { keys, context, dependencies } = await aVault();
    const recovered = await withRecoveryKey(
      keys,
      { current: PASSWORD, recoveryKey: generateRecoveryKey(dependencies.random) },
      dependencies
    );
    assert(recovered.ok);
    const rotated = await withNewKey(
      recovered.value,
      { password: TEST_PASSWORD, params: ARGON2_FLOOR },
      dependencies
    );
    assert(rotated.ok);
    const file = await sealVaultFile(
      aFileContent(),
      { ...context, ...rotated.value },
      dependencies.random
    );

    expect(rotated.value.keyId).not.toEqual(keys.keyId);
    expect(rotated.value.vaultId).toEqual(keys.vaultId);
    expect(rotated.value.keyslots.map(slot => slot.kind)).toEqual(['password']);
    expect(rotated.value.keyslotsEpoch).toBe(recovered.value.keyslotsEpoch + 1);
    expect(
      (
        await openVaultFile(
          file,
          { kind: 'password', password: TEST_PASSWORD },
          dependencies.argon2
        )
      ).ok
    ).toBe(true);
    expect(
      await openVaultFile(
        file,
        { kind: 'session', dek: keys.dek, keyId: keys.keyId },
        dependencies.argon2
      )
    ).toEqual({ ok: false, error: { kind: 'key-rotated' } });
  });

  it('refuses without the master password', async () => {
    const { keys, dependencies } = await aVault();

    expect(
      await withNewKey(keys, { password: NEW_PASSWORD, params: ARGON2_FLOOR }, dependencies)
    ).toEqual({ ok: false, error: 'wrong-password' });
  });
});

describe('passkeys', () => {
  it('open the vault with their PRF output, each with its own slot, until removed', async () => {
    const { keys, context, dependencies } = await aVault();
    const laptop = {
      credentialId: Uint8Array.of(1, 2),
      rpId: 'vault.example',
      prfOutput: dependencies.random.bytes(32),
    };
    const phone = {
      credentialId: Uint8Array.of(3, 4),
      rpId: 'vault.example',
      prfOutput: dependencies.random.bytes(32),
    };
    const once = await withPasskey(
      keys,
      { current: PASSWORD, ...laptop, prfOutput: laptop.prfOutput.slice() },
      dependencies
    );
    assert(once.ok);
    const twice = await withPasskey(
      once.value,
      { current: PASSWORD, ...phone, prfOutput: phone.prfOutput.slice() },
      dependencies
    );
    assert(twice.ok);
    const opens = async (current: typeof twice.value, passkey: typeof laptop) => {
      const file = await sealVaultFile(
        aFileContent(),
        { ...context, ...current },
        dependencies.random
      );
      return (
        await openVaultFile(
          file,
          { kind: 'prf', ...passkey, prfOutput: passkey.prfOutput.slice() },
          dependencies.argon2
        )
      ).ok;
    };

    expect(twice.value.keyslots.map(slot => slot.kind).sort()).toEqual(['password', 'prf', 'prf']);
    expect(await opens(twice.value, laptop)).toBe(true);
    expect(await opens(twice.value, phone)).toBe(true);
    const removed = withoutPasskey(twice.value, laptop.credentialId);
    expect(removed.keyslotsEpoch).toBe(twice.value.keyslotsEpoch + 1);
    expect(await opens(removed, laptop)).toBe(false);
    expect(await opens(removed, phone)).toBe(true);
  });
});
