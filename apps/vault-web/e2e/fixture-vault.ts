import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { createDriveTransport } from '@frozik/cloud-storage/google-drive/drive-transport';
import {
  createFakeDriveServer,
  fakeTokenSource,
} from '@frozik/cloud-storage/google-drive/fake-drive-server.test-helper';
import { createGoogleDriveProvider } from '@frozik/cloud-storage/google-drive/google-drive-provider';
import type { Milliseconds } from '@frozik/utils/date/types';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { HASH_WASM_KDF } from '@frozik/vault/crypto/adapters/kdf-hash-wasm';
import { ARGON2_FLOOR } from '@frozik/vault/crypto/kdf-port';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';
import { createVaultKeys } from '@frozik/vault/format/vault-keys';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import { aCardWith, aField, anHlc } from '@frozik/vault/testing/builders';

export const FIXTURE_PASSWORD = 'e2e master password';
export const FIXTURE_LOGIN = 'jane@example.test';
const FIXTURE_FILE = 'Vault/Family.pwv';
const AT = anHlc(1_760_000_000_000, 'fixture');
/** Weak, and the same on two cards: what the audit must find. */
const WEAK_REUSED_PASSWORD = '123456';

/** How many cards the fixture holds. */
export const FIXTURE_CARDS = 5;

/** The cards the phone e2e reads: a login with a one-time code, a favourite, a protected note, two weak twins. */
const CARDS = [
  aCardWith(
    [
      aField({ kind: 'login' }, FIXTURE_LOGIN, { label: 'Login' }),
      aField({ kind: 'password', rotateEveryDays: null }, 'correct-battery-42', {
        label: 'Password',
        sensitive: true,
      }),
      aField({ kind: 'otp' }, 'otpauth://totp/Mail?secret=JBSWY3DPEHPK3PXP', {
        label: 'One-time code',
        sensitive: true,
      }),
    ],
    { title: 'Mail', createdAt: AT, updatedAt: AT }
  ),
  aCardWith([aField({ kind: 'login' }, 'jane', { label: 'Login' })], {
    title: 'Bank',
    favorite: true,
    createdAt: AT,
    updatedAt: AT,
  }),
  aCardWith(
    [
      aField({ kind: 'secret' }, 'the safe is behind the painting', {
        label: 'Secret',
        sensitive: true,
      }),
    ],
    { title: 'Safe', protected: true, createdAt: AT, updatedAt: AT }
  ),
  ...['Forum', 'Shop'].map(title =>
    aCardWith(
      [
        aField({ kind: 'login' }, 'jane', { label: 'Login' }),
        aField({ kind: 'password', rotateEveryDays: null }, WEAK_REUSED_PASSWORD, {
          label: 'Password',
          sensitive: true,
        }),
      ],
      { title, createdAt: AT, updatedAt: AT }
    )
  ),
];

/** A Drive that already holds a vault with those cards, sealed by the real codec at the lowest Argon2 a reader accepts. */
export async function aDriveWithAVault(): Promise<ReturnType<typeof createFakeDriveServer>> {
  const server = createFakeDriveServer();
  const keys = await createVaultKeys(encodePassword(FIXTURE_PASSWORD), ARGON2_FLOOR, {
    argon2: HASH_WASM_KDF,
    random: WEB_RANDOM,
  });
  const codec = createInThreadCodec({
    argon2: HASH_WASM_KDF,
    random: WEB_RANDOM,
    elapsed: () => 0 as Milliseconds,
  });
  const signal = new AbortController().signal;
  const sealed = await codec.seal(
    { ...emptyVaultDocument('Family', AT), cards: new Map(CARDS.map(card => [card.id, card])) },
    {
      format: 'pwv',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: '2026-10-13T00:00:00Z',
      createdBy: 'vault-web e2e fixture',
    },
    { ...keys, revision: 1, movedTo: null },
    signal
  );
  if (!sealed.ok) {
    throw new Error(`the fixture did not seal: ${JSON.stringify(sealed.error)}`);
  }
  const drive = createGoogleDriveProvider({
    transport: createDriveTransport(fakeTokenSource(), server.fetch),
    space: 'my-drive',
  });
  const written = await drive.write(
    storagePath(FIXTURE_FILE),
    sealed.value,
    { kind: 'absent' },
    signal
  );
  if (!written.ok) {
    throw new Error(`the fixture did not reach the fake Drive: ${JSON.stringify(written.error)}`);
  }
  return server;
}
