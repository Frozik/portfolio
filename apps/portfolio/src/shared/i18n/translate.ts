import { getCurrentLanguage } from './locale';
import type { Language } from './types';

export function resolveTranslation<T>(translations: Record<Language, T>): T {
  return translations[getCurrentLanguage()];
}
