import { parseJson } from '@frozik/utils/parseJson';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { utf8, utf8Text } from '../crypto/bytes';
import type { IVaultMeta } from '../model/vault-meta';
import { EMPTY_VAULT_META } from '../model/vault-meta';
import type { IContainerEntry } from './container';
import { PASSWORD_STRENGTH_SCHEMA } from './document-schema';

const PASSWORD_STRENGTH_PATH = 'meta/password-strength.json';

/** The vault's own cache from the container; a missing or damaged one is empty — it is counted again. */
export function metaOf(entries: ReadonlyMap<string, TBytes>): IVaultMeta {
  const bytes = entries.get(PASSWORD_STRENGTH_PATH);
  const parsed = PASSWORD_STRENGTH_SCHEMA.safeParse(
    parseJson<unknown>(isNil(bytes) ? null : utf8Text(bytes))
  );
  if (!parsed.success) {
    return EMPTY_VAULT_META;
  }
  return {
    strength: new Map(
      Object.entries(parsed.data).map(([meter, scores]) => [meter, new Map(Object.entries(scores))])
    ),
  };
}

/** Written only when it holds something: a vault without it stays byte for byte as it was. */
export function metaEntries(meta: IVaultMeta): readonly IContainerEntry[] {
  if (meta.strength.size === 0) {
    return [];
  }
  const strength = Object.fromEntries(
    [...meta.strength].map(([meter, scores]) => [meter, Object.fromEntries(scores)])
  );
  return [{ path: PASSWORD_STRENGTH_PATH, bytes: utf8(JSON.stringify(strength)), compress: true }];
}
