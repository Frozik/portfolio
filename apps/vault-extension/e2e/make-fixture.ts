import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Milliseconds } from '@frozik/utils/date/types';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { HASH_WASM_KDF } from '@frozik/vault/crypto/adapters/kdf-hash-wasm';
import { ARGON2_FLOOR } from '@frozik/vault/crypto/kdf-port';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';
import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';
import { createVaultKeys } from '@frozik/vault/format/vault-keys';
import type { IVaultCard } from '@frozik/vault/model/card';
import type { TCardId, TFieldId, TTabId, TTemplateId } from '@frozik/vault/model/ids';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';

/**
 * The vault the e2e test opens: one account for the test site, sealed by the
 * real codec at the lowest Argon2 a reader accepts, which opens in a moment. Run with
 * `pnpm run fixture` after a format change.
 */
const AT = { wallMs: 1_760_000_000_000, counter: 0, node: 'fixture' };

const card: IVaultCard = {
  id: 'card-e2e' as TCardId,
  title: 'Test login',
  templateId: 'internet-account' as TTemplateId,
  tabs: [
    {
      id: 'tab-e2e' as TTabId,
      title: null,
      fields: [
        {
          id: 'url' as TFieldId,
          label: 'Websites',
          spec: { kind: 'url', match: 'host', useSharedCredentials: true },
          value: { cardinality: 'list', values: ['https://login.example.test'] },
          sensitive: false,
          excludeFromAudit: false,
        },
        {
          id: 'login' as TFieldId,
          label: 'Login',
          spec: { kind: 'login' },
          value: { cardinality: 'single', value: 'jane@example.test' },
          sensitive: false,
          excludeFromAudit: false,
        },
        {
          id: 'password' as TFieldId,
          label: 'Password',
          spec: { kind: 'password', rotateEveryDays: null },
          value: { cardinality: 'single', value: 'correct-battery-42' },
          sensitive: true,
          excludeFromAudit: false,
        },
      ],
    },
  ],
  groupIds: [],
  favorite: false,
  color: null,
  icon: { kind: 'auto' },
  protected: false,
  archivedAt: null,
  trashedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ancestors: [],
  history: [],
};

const random = WEB_RANDOM;
const keys = await createVaultKeys(encodePassword('e2e master password'), ARGON2_FLOOR, {
  argon2: HASH_WASM_KDF,
  random,
});
const codec = createInThreadCodec({
  argon2: HASH_WASM_KDF,
  random,
  elapsed: () => 0 as Milliseconds,
});
const sealed = await codec.seal(
  { ...emptyVaultDocument('E2E', AT), cards: new Map([[card.id, card]]) },
  {
    format: 'pwv',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: '2026-10-12T00:00:00Z',
    createdBy: 'vault-extension e2e fixture',
  },
  { ...keys, revision: 1, movedTo: null, preserved: [] },
  new AbortController().signal
);
if (!sealed.ok) {
  throw new Error(`the fixture did not seal: ${JSON.stringify(sealed.error)}`);
}
writeFileSync(fileURLToPath(new URL('fixtures/e2e.pwv', import.meta.url)), sealed.value);
