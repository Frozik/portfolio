import { ARGON2_FLOOR } from '../crypto/kdf-port';
import type { TKeyslot } from '../crypto/keyslot';
import { encodeHeader } from '../format/header';
import { opensWithRecoveryKey } from './recovery-key-of';

const bytes = (length: number, fill: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(length).fill(fill);
const sealing = { salt: bytes(16, 1), wrapNonce: bytes(12, 2), wrappedDek: bytes(48, 3) };
const password: TKeyslot = {
  kind: 'password',
  kdf: { kind: 'argon2id', params: ARGON2_FLOOR },
  ...sealing,
};

function aFile(extra: readonly TKeyslot[]): Uint8Array<ArrayBuffer> {
  return encodeHeader({
    vaultId: bytes(16, 9),
    revision: 4,
    saveSalt: bytes(32, 8),
    chunkSize: 65_536,
    payloadLength: 1234,
    keyCheck: bytes(32, 7),
    keyId: bytes(16, 6),
    keyslotsEpoch: 2,
    keyGeneration: 0,
    keyslots: [password, ...extra],
    movedTo: null,
    preserved: [],
  });
}

describe('a recovery key for a locked vault', () => {
  it('is offered when the header holds its slot', () => {
    expect(opensWithRecoveryKey(aFile([{ kind: 'recovery', ...sealing }]))).toBe(true);
  });

  it('is not offered when the vault opens with its password alone', () => {
    expect(opensWithRecoveryKey(aFile([]))).toBe(false);
  });

  it('is still offered when the header cannot be read', () => {
    expect(opensWithRecoveryKey(bytes(8, 0))).toBe(true);
  });
});
