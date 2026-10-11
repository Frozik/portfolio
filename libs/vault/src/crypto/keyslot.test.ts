import { createFakeKdf } from '../testing/fake-kdf';
import { fromHex } from '../testing/hex';
import { createSeededRandom } from '../testing/seeded-random';
import { HASH_WASM_KDF } from './adapters/kdf-hash-wasm';
import { toHex } from './bytes';
import type { TBytes } from './bytes';
import { deriveKeyCheck, importDek } from './dek';
import { ARGON2_DEFAULT, ARGON2_FLOOR } from './kdf-port';
import type { TKeyslot } from './keyslot';
import { createKeyslot, deriveSlotKek, unwrapDek, unwrapDekBytes } from './keyslot';
import { encodePassword } from './password-normalization';

const VAULT_ID = fromHex('000102030405060708090a0b0c0d0e0f');
const RAW_DEK = fromHex('202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f');
const SEALING = { salt: fromHex('a5'.repeat(16)), wrapNonce: fromHex('5a'.repeat(12)) };
const RECOVERY_KEY = fromHex('707172737475767778797a7b7c7d7e7f');

/** Slots wrapped by an independent implementation (Python `cryptography` over OpenSSL) by. */
const FOREIGN_SLOTS = {
  argon2: {
    kind: 'password',
    kdf: { kind: 'argon2id', params: ARGON2_FLOOR },
    ...SEALING,
    wrappedDek: fromHex(
      '856b8f8b969c4d92998008f6af6836eb58c4992ddb4629d5ff7dbb19fbb424bda8b094b76ce321783ffe39be81b7625b'
    ),
  },
  pbkdf2: {
    kind: 'password',
    kdf: { kind: 'pbkdf2-sha256', iterations: 600_000 },
    ...SEALING,
    wrappedDek: fromHex(
      '1d4e59afea5f20686d46829655e6c00cdd2f4a3d3f2ac93510d0f02bdc1e95a15fab6832cffd550f3c1ec58e97d8e9df'
    ),
  },
  recovery: {
    kind: 'recovery',
    ...SEALING,
    wrappedDek: fromHex(
      '8ef3b825c1aa289b3c1ed028555bd0241cc6ae10f69084383ce1e3fb223ad86d05b115e6ff1e00224bacf79e99889ce5'
    ),
  },
} satisfies Record<string, TKeyslot>;

async function openBytes(
  slot: TKeyslot,
  secret: TBytes,
  vaultId = VAULT_ID
): Promise<string | null> {
  const opened = await unwrapDekBytes(
    slot,
    await deriveSlotKek(slot, secret, HASH_WASM_KDF),
    vaultId
  );
  return opened.ok ? toHex(opened.value) : null;
}

describe('key slots', () => {
  it.each([
    ['an Argon2id password slot', FOREIGN_SLOTS.argon2, encodePassword('пароль й')],
    ['a PBKDF2 password slot (read-only kind)', FOREIGN_SLOTS.pbkdf2, encodePassword('пароль й')],
    ['a recovery slot', FOREIGN_SLOTS.recovery, RECOVERY_KEY],
  ])('opens %s wrapped by another implementation', async (_name, slot, secret) => {
    expect(await openBytes(slot, secret)).toBe(toHex(RAW_DEK));
  });

  it('opens a slot with the decomposed form of the password it was made with', async () => {
    expect(await openBytes(FOREIGN_SLOTS.argon2, encodePassword('пароль й'))).toBe(toHex(RAW_DEK));
  });

  it('unwraps the web way into a non-extractable key with the same key check', async () => {
    const slot = FOREIGN_SLOTS.recovery;
    const kek = await deriveSlotKek(slot, RECOVERY_KEY, HASH_WASM_KDF);

    const dek = await unwrapDek(slot, kek, VAULT_ID);

    expect(dek.ok && dek.value.extractable).toBe(false);
    expect(dek.ok && toHex(await deriveKeyCheck(dek.value))).toBe(
      toHex(await deriveKeyCheck(await importDek(RAW_DEK)))
    );
  });

  describe('a new slot', () => {
    const dependencies = { argon2: createFakeKdf(), random: createSeededRandom(7) };

    it.each([
      ['password', { kind: 'password', params: ARGON2_DEFAULT }, encodePassword('correct horse')],
      ['passkey', { kind: 'prf', credentialId: fromHex('c0ffee') }, fromHex('11'.repeat(32))],
      ['recovery', { kind: 'recovery' }, RECOVERY_KEY],
    ] as const)('of kind %s opens with its own secret only', async (_name, spec, secret) => {
      const slot = await createKeyslot(spec, secret, RAW_DEK, VAULT_ID, dependencies);
      const wrongSecret = secret.slice();
      wrongSecret[0] = (wrongSecret[0] ?? 0) ^ 1;

      const kek = await deriveSlotKek(slot, secret, dependencies.argon2);
      expect(await unwrapDekBytes(slot, kek, VAULT_ID)).toEqual({ ok: true, value: RAW_DEK });
      expect(
        await unwrapDek(slot, await deriveSlotKek(slot, wrongSecret, dependencies.argon2), VAULT_ID)
      ).toEqual({
        ok: false,
        error: 'wrong-secret',
      });
    });

    it('does not open when carried into another vault', async () => {
      const password = encodePassword('correct horse');
      const slot = await createKeyslot(
        { kind: 'password', params: ARGON2_DEFAULT },
        password,
        RAW_DEK,
        VAULT_ID,
        dependencies
      );
      const kek = await deriveSlotKek(slot, password, dependencies.argon2);

      expect(await unwrapDekBytes(slot, kek, fromHex('ff'.repeat(16)))).toEqual({
        ok: false,
        error: 'wrong-secret',
      });
    });

    it('does not open when relabelled as another kind of slot', async () => {
      const slot = await createKeyslot(
        { kind: 'recovery' },
        RECOVERY_KEY,
        RAW_DEK,
        VAULT_ID,
        dependencies
      );
      const relabelled: TKeyslot = { ...slot, kind: 'prf', credentialId: fromHex('00') };
      const kek = await deriveSlotKek(
        { kind: 'recovery', salt: slot.salt },
        RECOVERY_KEY,
        dependencies.argon2
      );

      expect(await unwrapDekBytes(relabelled, kek, VAULT_ID)).toEqual({
        ok: false,
        error: 'wrong-secret',
      });
    });

    it('never reuses a salt or a nonce', async () => {
      const spec = { kind: 'recovery' } as const;
      const first = await createKeyslot(spec, RECOVERY_KEY, RAW_DEK, VAULT_ID, dependencies);
      const second = await createKeyslot(spec, RECOVERY_KEY, RAW_DEK, VAULT_ID, dependencies);

      expect(toHex(first.salt)).not.toBe(toHex(second.salt));
      expect(toHex(first.wrapNonce)).not.toBe(toHex(second.wrapNonce));
    });
  });
});
