import { resolveTranslation } from '../../../../shared/i18n/translate';
import { sudokuTranslationsEn } from './en';
import { sudokuTranslationsRu } from './ru';

export const sudokuT = resolveTranslation({
  en: sudokuTranslationsEn,
  ru: sudokuTranslationsRu,
});
