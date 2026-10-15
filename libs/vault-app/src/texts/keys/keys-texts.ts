import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { keysTranslationsEn } from './keys-en';
import { keysTranslationsRu } from './keys-ru';

/** Passwords, passkeys and the recovery key, in every language the app speaks. */
export const KEYS_TEXTS = { en: keysTranslationsEn, ru: keysTranslationsRu };

export type TKeysTexts = TextsOf<typeof keysTranslationsEn>;
