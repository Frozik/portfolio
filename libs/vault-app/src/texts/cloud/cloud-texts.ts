import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { cloudTranslationsEn } from './cloud-en';
import { cloudTranslationsRu } from './cloud-ru';

/** The Google Drive and WebDAV panels, in every language the app speaks. */
export const CLOUD_TEXTS = { en: cloudTranslationsEn, ru: cloudTranslationsRu };

export type TCloudTexts = TextsOf<typeof cloudTranslationsEn>;
