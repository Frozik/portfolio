import { resolveTranslation } from '../i18n';
import { sharedTranslationsEn } from './en';
import { sharedTranslationsRu } from './ru';

export const sharedT = resolveTranslation({
  en: sharedTranslationsEn,
  ru: sharedTranslationsRu,
});
