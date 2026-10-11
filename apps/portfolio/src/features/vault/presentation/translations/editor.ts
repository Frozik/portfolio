import { resolveTranslation } from '../../../../shared/i18n/translate';
import { editorTranslationsEn } from './editor-en';
import { editorTranslationsRu } from './editor-ru';

export const editorT = resolveTranslation({
  en: editorTranslationsEn,
  ru: editorTranslationsRu,
});
