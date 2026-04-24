import { resolveTranslation } from '../../../../shared/i18n/translate';
import { retroEnTranslations } from './en';
import { retroRuTranslations } from './ru';

export const retroT = resolveTranslation({
  en: retroEnTranslations,
  ru: retroRuTranslations,
});

export type RetroTranslations = typeof retroEnTranslations;
