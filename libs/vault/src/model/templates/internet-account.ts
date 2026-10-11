import { defineTemplate, list, NOTES, single } from './template';

export const INTERNET_ACCOUNT_TEMPLATE = defineTemplate({
  id: 'internet-account',
  nameKey: 'template.internetAccount',
  icon: 'globe',
  subtitleFieldKind: 'login',
  tabs: [
    {
      titleKey: null,
      fields: [
        list('url', 'field.websites'),
        single('login', 'field.login'),
        single('password', 'field.password'),
        single('email', 'field.email'),
        NOTES,
      ],
    },
  ],
});
