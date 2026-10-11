import { defineTemplate, NOTES, single } from './template';

export const BANK_ACCOUNT_US_TEMPLATE = defineTemplate({
  id: 'bank-account-us',
  nameKey: 'template.bankAccountUs',
  icon: 'landmark',
  subtitleFieldKind: 'bank-account',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('text', 'field.bank'),
        single('text', 'field.accountHolder'),
        single('bank-code', 'field.routingNumber', { kind: 'bank-code', scheme: 'aba-routing' }),
        single('bank-account', 'field.accountNumber'),
        single('select', 'field.accountType', {
          kind: 'select',
          options: ['option.checking', 'option.savings'],
          allowCustom: true,
        }),
        single('bic', 'field.swiftIncoming'),
        NOTES,
      ],
    },
  ],
});
