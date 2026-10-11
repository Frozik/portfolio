import { resolveTranslation } from '../../../../shared/i18n/translate';
import { dataTranslationsEn } from './data-en';
import { dataTranslationsRu } from './data-ru';

export const dataT = resolveTranslation({ en: dataTranslationsEn, ru: dataTranslationsRu });
