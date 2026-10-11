import { resolveTranslation } from '../../../../shared/i18n/translate';
import { auditTranslationsEn } from './audit-en';
import { auditTranslationsRu } from './audit-ru';

export const auditT = resolveTranslation({ en: auditTranslationsEn, ru: auditTranslationsRu });
