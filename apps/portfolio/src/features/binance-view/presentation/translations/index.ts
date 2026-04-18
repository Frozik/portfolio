import { resolveTranslation } from '../../../../shared/i18n';
import { binanceTranslationsEn } from './en';
import { binanceTranslationsRu } from './ru';

export const binanceT = resolveTranslation({
  en: binanceTranslationsEn,
  ru: binanceTranslationsRu,
});
