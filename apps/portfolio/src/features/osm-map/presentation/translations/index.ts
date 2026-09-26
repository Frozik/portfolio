import { resolveTranslation } from '../../../../shared/i18n/translate';
import { osmMapTranslationsEn } from './en';
import { osmMapTranslationsRu } from './ru';

export const osmMapT = resolveTranslation({
  en: osmMapTranslationsEn,
  ru: osmMapTranslationsRu,
});
