import { defineTemplate, list, NOTES, single } from './template';

const DOCUMENT_WARNING_DAYS = 180;

/** A passport takes months to renew, so it warns half a year ahead. */
export const DOCUMENT_TEMPLATE = defineTemplate({
  id: 'document',
  nameKey: 'template.document',
  icon: 'id-card',
  subtitleFieldKind: null,
  expiryWarningDays: DOCUMENT_WARNING_DAYS,
  tabs: [
    {
      titleKey: 'tab.details',
      fields: [
        single('secret', 'field.documentNumber'),
        single('text', 'field.issuedBy'),
        single('date', 'field.issuedOn'),
        single('expiry-date', 'field.expiresOn'),
        NOTES,
      ],
    },
    { titleKey: 'tab.scans', fields: [list('file', 'field.scans')] },
  ],
});
