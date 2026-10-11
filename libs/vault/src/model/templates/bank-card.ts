import { defineTemplate, NOTES, single } from './template';

export const BANK_CARD_TEMPLATE = defineTemplate({
  id: 'bank-card',
  nameKey: 'template.bankCard',
  icon: 'credit-card',
  subtitleFieldKind: 'card-number',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('card-number', 'field.cardNumber'),
        single('text', 'field.cardholder'),
        single('expiry-month', 'field.validThru'),
        single('cvv', 'field.securityCode'),
        single('pin', 'field.pin'),
        single('phone', 'field.lostCardPhone'),
        NOTES,
      ],
    },
  ],
});
