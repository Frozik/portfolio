import { defineTemplate, NOTES, single } from './template';

/** The international default: IBAN and SWIFT work in every country that uses them. */
export const BANK_ACCOUNT_TEMPLATE = defineTemplate({
  id: 'bank-account',
  nameKey: 'template.bankAccount',
  icon: 'landmark',
  subtitleFieldKind: 'iban',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('text', 'field.bank'),
        single('text', 'field.accountHolder'),
        single('iban', 'field.iban'),
        single('bic', 'field.swift'),
        single('bank-account', 'field.accountNumber'),
        single('bank-code', 'field.bankCode', { kind: 'bank-code', scheme: 'national' }),
        single('select', 'field.accountType', {
          kind: 'select',
          options: ['option.current', 'option.savings', 'option.brokerage'],
          allowCustom: true,
        }),
        single('security-question', 'field.codeWord'),
        NOTES,
      ],
    },
  ],
});
