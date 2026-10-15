import { assert } from '@frozik/utils/assert/assert';

import { bytesEqual, toHex, utf8 } from '../crypto/bytes';
import { ARGON2_FLOOR } from '../crypto/kdf-port';
import type { TKeyslot } from '../crypto/keyslot';
import {
  FORMAT_V1_0_KEYSLOT_TYPE,
  isReadableByFormatV1_0,
  savedByFormatV1_0,
} from '../testing/format-v1-0';
import type { IVaultHeader } from './header';
import { decodeHeader, encodeHeader } from './header';
import type { ITlvRecord } from './header-tlv';
import { decodeKeyslot, encodeKeyslot } from './keyslot-codec';

const bytes = (length: number, fill: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(length).fill(fill);
const sealing = { salt: bytes(16, 1), wrapNonce: bytes(12, 2), wrappedDek: bytes(48, 3) };
const PORTFOLIO = 'frozik.github.io';
const PWA = 'ciphra-vault.github.io';

const passwordSlot: TKeyslot = {
  kind: 'password',
  kdf: { kind: 'argon2id', params: ARGON2_FLOOR },
  ...sealing,
};
const PORTFOLIO_ID = utf8('portfolio');
const portfolioPasskey: TKeyslot = {
  kind: 'prf',
  credentialId: PORTFOLIO_ID,
  rpId: PORTFOLIO,
  ...sealing,
};
const PWA_ID = utf8('pwa');
const pwaPasskey: TKeyslot = { kind: 'prf', credentialId: PWA_ID, rpId: PWA, ...sealing };

function aHeader(keyslots: IVaultHeader['keyslots']): IVaultHeader {
  return {
    vaultId: bytes(16, 9),
    revision: 4,
    saveSalt: bytes(32, 8),
    chunkSize: 65_536,
    payloadLength: 1234,
    keyCheck: bytes(32, 7),
    keyId: bytes(16, 6),
    keyslotsEpoch: 2,
    keyGeneration: 0,
    keyslots,
    movedTo: null,
    preserved: [],
  };
}

function keyslotsOf(file: Uint8Array<ArrayBuffer>): readonly TKeyslot[] {
  const decoded = decodeHeader(file);
  assert(decoded.ok);
  return decoded.value.header.keyslots;
}

describe('the sites of passkeys in a vault file', () => {
  it('leave a new file readable by a format 1.0 reader', () => {
    const file = encodeHeader(aHeader([passwordSlot, portfolioPasskey, pwaPasskey]));

    expect(isReadableByFormatV1_0(file)).toBe(true);
  });

  it('leave the passkey slot bytes exactly as format 1.0 writes them', () => {
    expect(toHex(encodeKeyslot(pwaPasskey))).toBe(
      `0203${'01'.repeat(16)}${'02'.repeat(12)}${'03'.repeat(48)}0300${toHex(PWA_ID)}`
    );
  });

  it('are unknown for a passkey of a file a format 1.0 client made', () => {
    const file = savedByFormatV1_0(encodeHeader(aHeader([passwordSlot, pwaPasskey])));

    expect(keyslotsOf(file)).toEqual([passwordSlot, { ...pwaPasskey, rpId: null }]);
  });

  it('become unknown, never wrong, once a format 1.0 client removed a passkey and saved', () => {
    const file = encodeHeader(aHeader([passwordSlot, portfolioPasskey, pwaPasskey]));
    const isPortfolioPasskey = (record: ITlvRecord): boolean => {
      const slot = decodeKeyslot(record.value, () => null);
      return (
        slot.ok && slot.value.kind === 'prf' && bytesEqual(slot.value.credentialId, PORTFOLIO_ID)
      );
    };

    const edited = savedByFormatV1_0(file, known =>
      known.filter(
        record => record.type !== FORMAT_V1_0_KEYSLOT_TYPE || !isPortfolioPasskey(record)
      )
    );

    expect(keyslotsOf(edited)).toEqual([passwordSlot, { ...pwaPasskey, rpId: null }]);
  });

  it('are written only for passkeys whose site is known', () => {
    const file = encodeHeader(
      aHeader([passwordSlot, { ...portfolioPasskey, rpId: null }, pwaPasskey])
    );

    expect(keyslotsOf(file)).toEqual([
      passwordSlot,
      { ...portfolioPasskey, rpId: null },
      pwaPasskey,
    ]);
  });
});
