import { getItem, setItem } from 'expo-secure-store';

import type { IQuickKeepStore } from '@frozik/vault-app/session/domain/ports/quick-keep';

const keyOf = (vaultKey: string): string => `quick-keep.${vaultKey}`;
/** What stands for no record: a full lock removes it right before the runtime restarts. */
const REMOVED = '';

/**
 * The quick lock kept across restarts, in `expo-secure-store` (encrypted by a Keystore key, no
 * prompt). Synchronous on purpose: a full lock's removal must land before the reload that follows
 * it, and the store has no synchronous delete, so a removal writes the empty value.
 */
export const SECURE_STORE_QUICK_KEEP: IQuickKeepStore = {
  read(vaultKey) {
    const text = getItem(keyOf(vaultKey));
    return text === null || text === REMOVED ? null : text;
  },
  write(vaultKey, text) {
    setItem(keyOf(vaultKey), text);
  },
  remove(vaultKey) {
    setItem(keyOf(vaultKey), REMOVED);
  },
};
