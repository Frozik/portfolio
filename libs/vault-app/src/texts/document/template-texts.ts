import type { TTranslate } from '@frozik/vault/model/card-edits';

import { templateTextsEn } from './template-texts-en';
import { templateTextsRu } from './template-texts-ru';

/** The built-in templates' names, tabs, labels and options, in every language the app speaks. */
export const TEMPLATE_TEXTS = { en: templateTextsEn, ru: templateTextsRu };

/** A key no table knows (a newer version's template) shows as itself rather than as nothing. */
export function templateKeyTranslator(table: Readonly<Record<string, string>>): TTranslate {
  return key => table[key] ?? key;
}
