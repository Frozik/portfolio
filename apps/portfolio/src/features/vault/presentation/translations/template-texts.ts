import { resolveTranslation } from '../../../../shared/i18n/translate';
import { templateTextsEn } from './template-texts-en';
import { templateTextsRu } from './template-texts-ru';

const templateTexts = resolveTranslation({ en: templateTextsEn, ru: templateTextsRu });

/** A key no table knows (a newer version's template) shows as itself rather than as nothing. */
export function translateTemplateKey(key: string): string {
  return templateTexts[key] ?? key;
}
