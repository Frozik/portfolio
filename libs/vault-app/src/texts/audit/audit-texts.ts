import type { TextsOf } from '@frozik/utils/i18n/texts-of';

import { auditTranslationsEn } from './audit-en';
import { auditTranslationsRu } from './audit-ru';

/** The password audit, in every language the app speaks. */
export const AUDIT_TEXTS = { en: auditTranslationsEn, ru: auditTranslationsRu };

export type TAuditTexts = TextsOf<typeof auditTranslationsEn>;
