import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { settingsTranslationsEn } from './settings-en';
import { settingsTranslationsRu } from './settings-ru';

/** The settings, in every language the app speaks. */
export const SETTINGS_TEXTS = { en: settingsTranslationsEn, ru: settingsTranslationsRu };

export type TSettingsTexts = TextsOf<typeof settingsTranslationsEn>;
