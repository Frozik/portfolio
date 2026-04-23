import { resolveTranslation } from '../../../../shared/i18n';
import { confEnTranslations } from './en';
import { confRuTranslations } from './ru';

export const confT = resolveTranslation({
  en: confEnTranslations,
  ru: confRuTranslations,
});

export type ConfTranslations = typeof confEnTranslations;
