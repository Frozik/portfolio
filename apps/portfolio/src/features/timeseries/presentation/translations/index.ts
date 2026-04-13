import { resolveTranslation } from '../../../../shared/i18n';
import { timeseriesTranslationsEn } from './en';
import { timeseriesTranslationsRu } from './ru';

export const timeseriesT = resolveTranslation({
  en: timeseriesTranslationsEn,
  ru: timeseriesTranslationsRu,
});
