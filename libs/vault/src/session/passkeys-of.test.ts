import { utf8 } from '../crypto/bytes';
import { ARGON2_FLOOR } from '../crypto/kdf-port';
import type { TKeyslot } from '../crypto/keyslot';
import { encodeHeader } from '../format/header';
import { savedByFormatV1_0 } from '../testing/format-v1-0';
import { passkeysOf } from './passkeys-of';

const bytes = (length: number, fill: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(length).fill(fill);
const sealing = { salt: bytes(16, 1), wrapNonce: bytes(12, 2), wrappedDek: bytes(48, 3) };
const PORTFOLIO = 'frozik.github.io';
const PWA = 'ciphra-vault.github.io';
const PORTFOLIO_ID = utf8('portfolio');
const PWA_ID = utf8('pwa');

function aFile(keyslots: readonly TKeyslot[]): Uint8Array<ArrayBuffer> {
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
    keyslots: [
      { kind: 'password', kdf: { kind: 'argon2id', params: ARGON2_FLOOR }, ...sealing },
      ...keyslots,
    ],
    movedTo: null,
    preserved: [],
  });
}

describe('passkeys of a locked vault', () => {
  const file = aFile([
    { kind: 'prf', credentialId: PORTFOLIO_ID, rpId: PORTFOLIO, ...sealing },
    { kind: 'prf', credentialId: PWA_ID, rpId: PWA, ...sealing },
  ]);

  it('are only the ones made on the site that asks', () => {
    expect(passkeysOf(file, PWA)).toEqual([PWA_ID]);
    expect(passkeysOf(file, PORTFOLIO)).toEqual([PORTFOLIO_ID]);
    expect(passkeysOf(file, 'elsewhere.example')).toEqual([]);
  });

  it('of an unknown site are offered on every site, for the browser to try', () => {
    const legacy = savedByFormatV1_0(file);

    expect(passkeysOf(legacy, PORTFOLIO)).toEqual([PORTFOLIO_ID, PWA_ID]);
    expect(passkeysOf(legacy, PWA)).toEqual([PORTFOLIO_ID, PWA_ID]);
  });
});
