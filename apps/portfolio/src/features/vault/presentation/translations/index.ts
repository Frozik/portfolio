import { resolveTranslation } from '../../../../shared/i18n/translate';
import { vaultTranslationsEn } from './en';
import { vaultTranslationsRu } from './ru';

export const vaultT = resolveTranslation({
  en: vaultTranslationsEn,
  ru: vaultTranslationsRu,
});
