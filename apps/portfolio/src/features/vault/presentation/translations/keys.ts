import { resolveTranslation } from '../../../../shared/i18n/translate';
import { keysTranslationsEn } from './keys-en';
import { keysTranslationsRu } from './keys-ru';

export const keysT = resolveTranslation({ en: keysTranslationsEn, ru: keysTranslationsRu });
