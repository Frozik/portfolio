import { defineTemplate, NOTES, single } from './template';

export const BANK_ACCOUNT_RU_TEMPLATE = defineTemplate({
  id: 'bank-account-ru',
  nameKey: 'template.bankAccountRu',
  icon: 'landmark',
  subtitleFieldKind: 'bank-account',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('text', 'field.bank'),
        single('text', 'field.accountHolder'),
        single('bank-account', 'field.accountNumber'),
        single('bank-code', 'field.ruBic', { kind: 'bank-code', scheme: 'ru-bic' }),
        single('bank-account', 'field.correspondentAccount'),
        single('select', 'field.accountType', {
          kind: 'select',
          options: ['option.current', 'option.savings', 'option.brokerage', 'option.iis'],
          allowCustom: true,
        }),
        single('security-question', 'field.codeWord'),
        NOTES,
      ],
    },
  ],
});
