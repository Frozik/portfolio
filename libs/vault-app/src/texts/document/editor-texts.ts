import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { editorTranslationsEn } from './editor-en';
import { editorTranslationsRu } from './editor-ru';

/** The card editor, in every language the app speaks. */
export const EDITOR_TEXTS = { en: editorTranslationsEn, ru: editorTranslationsRu };

export type TEditorTexts = TextsOf<typeof editorTranslationsEn>;
