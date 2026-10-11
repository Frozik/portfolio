import { assert } from '@frozik/utils/assert/assert';

import { importDek } from '../crypto/dek';
import { aFileContent, aVault, TEST_PASSWORD } from '../testing/vault-file-fixtures';
import { openVaultFile } from './open-vault';
import { sealVaultFile } from './seal-vault';
import { unwrapSessionDek } from './session-dek';

describe('the extension’s session key', () => {
  it('comes out of the file with the password and opens it again without one', async () => {
    const vault = await aVault(1);
    const file = await sealVaultFile(aFileContent(), vault.context, vault.dependencies.random);

    const session = await unwrapSessionDek(
      file,
      { kind: 'password', password: TEST_PASSWORD },
      vault.dependencies.argon2
    );
    assert(session.ok);
    const reopened = await openVaultFile(
      file,
      { kind: 'session', dek: await importDek(session.value.rawDek), keyId: session.value.keyId },
      vault.dependencies.argon2
    );

    expect(session.value.rawDek).toHaveLength(32);
    expect(reopened.ok).toBe(true);
  });

  it('is refused for a wrong password', async () => {
    const vault = await aVault(1);
    const file = await sealVaultFile(aFileContent(), vault.context, vault.dependencies.random);

    expect(
      await unwrapSessionDek(
        file,
        { kind: 'password', password: new TextEncoder().encode('wrong') },
        vault.dependencies.argon2
      )
    ).toEqual({ ok: false, error: { kind: 'wrong-password' } });
  });
});
