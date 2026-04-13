import { resolveTranslation } from '../../shared/i18n';
import { appTranslationsEn } from './en';
import { appTranslationsRu } from './ru';

export const appT = resolveTranslation({ en: appTranslationsEn, ru: appTranslationsRu });
