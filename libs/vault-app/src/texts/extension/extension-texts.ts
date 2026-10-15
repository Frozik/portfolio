import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { extensionTranslationsEn } from './extension-en';
import { extensionTranslationsRu } from './extension-ru';

/** The extension's popup, in every language the app speaks. */
export const EXTENSION_TEXTS = { en: extensionTranslationsEn, ru: extensionTranslationsRu };

export type TExtensionTexts = TextsOf<typeof extensionTranslationsEn>;
