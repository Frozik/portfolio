import { defineTemplate, NOTES, single } from './template';

export const BANK_ACCOUNT_UK_TEMPLATE = defineTemplate({
  id: 'bank-account-uk',
  nameKey: 'template.bankAccountUk',
  icon: 'landmark',
  subtitleFieldKind: 'bank-account',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('text', 'field.bank'),
        single('text', 'field.accountHolder'),
        single('bank-code', 'field.sortCode', { kind: 'bank-code', scheme: 'sort-code' }),
        single('bank-account', 'field.accountNumber'),
        single('iban', 'field.iban'),
        single('bic', 'field.swift'),
        NOTES,
      ],
    },
  ],
});
