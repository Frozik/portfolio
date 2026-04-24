import { resolveTranslation } from '../../../../shared/i18n/translate';
import { pendulumTranslationsEn } from './en';
import { pendulumTranslationsRu } from './ru';

export const pendulumT = resolveTranslation({
  en: pendulumTranslationsEn,
  ru: pendulumTranslationsRu,
});
