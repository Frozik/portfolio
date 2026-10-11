import { resolveTranslation } from '../../../../shared/i18n/translate';
import { versionsTranslationsEn } from './versions-en';
import { versionsTranslationsRu } from './versions-ru';

export const versionsT = resolveTranslation({
  en: versionsTranslationsEn,
  ru: versionsTranslationsRu,
});
