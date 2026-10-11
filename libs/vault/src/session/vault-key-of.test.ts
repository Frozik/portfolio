import { assert } from '@frozik/utils/assert/assert';

import sampleFile from '../../fixtures/v1.0/sample.pwv?inline';
import { HASH_WASM_KDF } from '../crypto/adapters/kdf-hash-wasm';
import { toHex } from '../crypto/bytes';
import { openVaultFile } from '../format/open-vault';
import { bytesOfDataUrl, GOLDEN_PASSWORD } from '../testing/golden-fixtures';
import { vaultKeyOf } from './vault-key-of';

describe('the vault a file belongs to', () => {
  it('is read from the header without a password, the same one the password opens', async () => {
    const file = bytesOfDataUrl(sampleFile);
    const opened = await openVaultFile(
      file,
      { kind: 'password', password: GOLDEN_PASSWORD },
      HASH_WASM_KDF
    );
    assert(opened.ok);

    expect(vaultKeyOf(file)).toBe(toHex(opened.value.keys.vaultId));
  });

  it('is nobody for bytes that are not a vault', () => {
    expect(vaultKeyOf(new TextEncoder().encode('not a vault'))).toBeNull();
  });
});
