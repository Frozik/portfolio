import { resolveTranslation } from '../../../../shared/i18n/translate';
import { settingsTranslationsEn } from './settings-en';
import { settingsTranslationsRu } from './settings-ru';

export const settingsT = resolveTranslation({
  en: settingsTranslationsEn,
  ru: settingsTranslationsRu,
});
