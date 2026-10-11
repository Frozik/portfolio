import { assert } from '@frozik/utils/assert/assert';
import * as fc from 'fast-check';

import { utf8 } from '../crypto/bytes';
import { ARGON2_CEILING, ARGON2_FLOOR } from '../crypto/kdf-port';
import type { TKeyslot } from '../crypto/keyslot';
import type { IVaultHeader } from './header';
import { decodeHeader, encodeHeader } from './header';
import { encodeTlv } from './header-tlv';

const PROPERTY_SEED = 20261011;
const bytes = (length: number, fill: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(length).fill(fill);
const sealing = { salt: bytes(16, 1), wrapNonce: bytes(12, 2), wrappedDek: bytes(48, 3) };
const passwordSlot: TKeyslot = {
  kind: 'password',
  kdf: { kind: 'argon2id', params: ARGON2_FLOOR },
  ...sealing,
};

function aHeader(overrides: Partial<IVaultHeader> = {}): IVaultHeader {
  return {
    vaultId: bytes(16, 9),
    revision: 42,
    saveSalt: bytes(32, 8),
    chunkSize: 65_536,
    payloadLength: 1234,
    keyCheck: bytes(32, 7),
    keyId: bytes(16, 6),
    keyslotsEpoch: 3,
    keyGeneration: 0,
    keyslots: [passwordSlot],
    movedTo: null,
    preserved: [],
    ...overrides,
  };
}

/** A valid preamble around hand-written TLVs, to reach the checks behind it. */
function withRecords(records: Parameters<typeof encodeTlv>[0]): Uint8Array<ArrayBuffer> {
  const encoded = encodeHeader(aHeader());
  const body = encodeTlv(records);
  const file = new Uint8Array(16 + body.length);
  file.set(encoded.slice(0, 12));
  new DataView(file.buffer).setUint32(12, 16 + body.length, true);
  file.set(body, 16);
  return file;
}

describe('vault header', () => {
  it('reads back every field it writes, with every kind of slot', () => {
    const header = aHeader({
      keyslots: [
        passwordSlot,
        { kind: 'prf', credentialId: utf8('credential'), ...sealing },
        { kind: 'recovery', ...sealing },
      ],
      movedTo: 'google-drive:file-id',
      preserved: [{ type: 0x40, skippable: true, value: utf8('later') }],
    });

    const decoded = decodeHeader(encodeHeader(header));

    assert(decoded.ok);
    expect(decoded.value.header).toEqual(header);
  });

  it('reads a PBKDF2 password slot, the read-only kind', () => {
    const header = aHeader({
      keyslots: [
        { kind: 'password', kdf: { kind: 'pbkdf2-sha256', iterations: 600_000 }, ...sealing },
      ],
    });

    expect(decodeHeader(encodeHeader(header)).ok).toBe(true);
  });

  it('refuses a second password slot or a pile of slots: each one would cost a KDF run', () => {
    const recovery: TKeyslot = { kind: 'recovery', ...sealing };
    const twoPasswords = aHeader({ keyslots: [passwordSlot, passwordSlot] });
    const pile = aHeader({
      keyslots: [passwordSlot, ...Array.from({ length: 16 }, () => recovery)],
    });

    expect(decodeHeader(encodeHeader(twoPasswords))).toEqual({
      ok: false,
      error: 'unsupported-format',
    });
    expect(decodeHeader(encodeHeader(pile))).toEqual({ ok: false, error: 'unsupported-format' });
  });

  it('takes the header bytes alone, whatever follows them', () => {
    const encoded = encodeHeader(aHeader());
    const decoded = decodeHeader(new Uint8Array([...encoded, 1, 2, 3]));

    expect(decoded.ok && decoded.value.headerBytes).toEqual(encoded);
  });

  it.each([
    ['another magic', (file: Uint8Array) => file.set(utf8('NOTVAULT'), 0)],
    ['another major version', (file: Uint8Array) => file.set([2, 0], 8)],
  ])('is not a vault this build reads with %s', (_name, mutate) => {
    const file = encodeHeader(aHeader());
    mutate(file);

    expect(decodeHeader(file)).toEqual({ ok: false, error: 'unsupported-format' });
  });

  it.each([
    ['below the floor', { ...ARGON2_FLOOR, memoryKib: ARGON2_FLOOR.memoryKib / 2 }],
    ['above the ceiling', { ...ARGON2_CEILING, iterations: ARGON2_CEILING.iterations + 1 }],
  ])('refuses a slot with Argon2 parameters %s', (_name, params) => {
    const header = aHeader({ keyslots: [{ ...passwordSlot, kdf: { kind: 'argon2id', params } }] });

    expect(decodeHeader(encodeHeader(header))).toEqual({ ok: false, error: 'unsupported-format' });
  });

  it('refuses a chunk size outside the bounds as unsupported', () => {
    expect(decodeHeader(encodeHeader(aHeader({ chunkSize: 16 })))).toEqual({
      ok: false,
      error: 'unsupported-format',
    });
  });

  it('refuses an unknown record unless it is marked skippable', () => {
    const unknown = { type: 0x40, skippable: false, value: utf8('later') };

    expect(decodeHeader(encodeHeader(aHeader({ preserved: [unknown] })))).toEqual({
      ok: false,
      error: 'unsupported-format',
    });
  });

  it('refuses a header without a password slot, with a field twice, or with a field missing', () => {
    const corrupted = { ok: false, error: 'corrupted' };
    const recoveryOnly = aHeader({ keyslots: [{ kind: 'recovery', ...sealing }] });

    expect(decodeHeader(encodeHeader(recoveryOnly))).toEqual(corrupted);
    expect(
      decodeHeader(
        withRecords([
          { type: 0x01, skippable: false, value: bytes(16, 0) },
          { type: 0x01, skippable: false, value: bytes(16, 0) },
        ])
      )
    ).toEqual(corrupted);
    expect(
      decodeHeader(withRecords([{ type: 0x01, skippable: false, value: bytes(16, 0) }]))
    ).toEqual(corrupted);
  });

  it('answers any bytes with a header or a typed error, never an exception', () => {
    const valid = encodeHeader(aHeader());
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 512 }), randomBytes => {
        const result = decodeHeader(new Uint8Array(randomBytes));
        return result.ok || ['corrupted', 'unsupported-format'].includes(result.error);
      }),
      { seed: PROPERTY_SEED }
    );
    fc.assert(
      fc.property(fc.nat(valid.length - 1), fc.integer({ min: 1, max: 255 }), (index, flip) => {
        const mutated = valid.slice();
        mutated[index] = (mutated[index] ?? 0) ^ flip;
        const result = decodeHeader(mutated);
        return result.ok || ['corrupted', 'unsupported-format'].includes(result.error);
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('carries the key generation of a rotated key, and leaves a never rotated header as it was', () => {
    const rotated = decodeHeader(encodeHeader(aHeader({ keyGeneration: 2 })));
    const first = encodeHeader(aHeader());

    expect(rotated.ok && rotated.value.header.keyGeneration).toBe(2);
    expect(first).toEqual(encodeHeader(aHeader({ keyGeneration: 0 })));
    expect(first.length).toBeLessThan(encodeHeader(aHeader({ keyGeneration: 1 })).length);
  });
});
