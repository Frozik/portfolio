import { resolveTranslation } from '../../../../shared/i18n/translate';
import { tanksTranslationsEn } from './en';
import { tanksTranslationsRu } from './ru';

export const tanksT = resolveTranslation({
  en: tanksTranslationsEn,
  ru: tanksTranslationsRu,
});
