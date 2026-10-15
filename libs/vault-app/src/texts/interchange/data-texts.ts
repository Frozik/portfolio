import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { dataTranslationsEn } from './data-en';
import { dataTranslationsRu } from './data-ru';

/** Import and export, in every language the app speaks. */
export const DATA_TEXTS = { en: dataTranslationsEn, ru: dataTranslationsRu };

export type TDataTexts = TextsOf<typeof dataTranslationsEn>;
