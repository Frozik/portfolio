import type { Language } from '@frozik/utils/i18n/language';
import { pageLanguage } from '@frozik/utils/i18n/page-language';

export function resolveTranslation<T>(translations: Record<Language, T>): T {
  return translations[pageLanguage()];
}
