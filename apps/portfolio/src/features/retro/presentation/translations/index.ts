import { retroEnTranslations } from './en';
import { retroRuTranslations } from './ru';

export const retroTranslations = {
  en: retroEnTranslations,
  ru: retroRuTranslations,
} as const;

export type RetroTranslations = typeof retroEnTranslations;

export { retroEnTranslations, retroRuTranslations };
