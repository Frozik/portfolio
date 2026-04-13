import { resolveTranslation } from '../../../../shared/i18n';
import { sudokuTranslationsEn } from './en';
import { sudokuTranslationsRu } from './ru';

export const sudokuT = resolveTranslation({
  en: sudokuTranslationsEn,
  ru: sudokuTranslationsRu,
});
