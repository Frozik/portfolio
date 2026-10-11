import { resolveTranslation } from '../../../../shared/i18n/translate';
import { cloudTranslationsEn } from './cloud-en';
import { cloudTranslationsRu } from './cloud-ru';

export const cloudT = resolveTranslation({ en: cloudTranslationsEn, ru: cloudTranslationsRu });
