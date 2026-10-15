import {
  TEMPLATE_TEXTS,
  templateKeyTranslator,
} from '@frozik/vault-app/texts/document/template-texts';

import { LANGUAGE } from './language';

export const translateTemplateKey = templateKeyTranslator(TEMPLATE_TEXTS[LANGUAGE]);
