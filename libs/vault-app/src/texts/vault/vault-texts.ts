import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { vaultTranslationsEn } from './vault-en';
import { vaultTranslationsRu } from './vault-ru';

/** The vault's screens, in every language the app speaks. */
export const VAULT_TEXTS = { en: vaultTranslationsEn, ru: vaultTranslationsRu };

export type TVaultTexts = TextsOf<typeof vaultTranslationsEn>;
