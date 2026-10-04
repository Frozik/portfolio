import { resolveTranslation } from '../../../../shared/i18n/translate';
import { transportTranslationsEn } from './en';
import { transportTranslationsRu } from './ru';

export const transportT = resolveTranslation({
  en: transportTranslationsEn,
  ru: transportTranslationsRu,
});
