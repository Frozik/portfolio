import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { versionsTranslationsEn } from './versions-en';
import { versionsTranslationsRu } from './versions-ru';

/** A card's history and concurrent versions, in every language the app speaks. */
export const VERSIONS_TEXTS = { en: versionsTranslationsEn, ru: versionsTranslationsRu };

export type TVersionsTexts = TextsOf<typeof versionsTranslationsEn>;
