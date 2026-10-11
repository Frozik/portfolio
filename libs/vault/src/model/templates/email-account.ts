import { defineTemplate, list, NOTES, single } from './template';

export const EMAIL_ACCOUNT_TEMPLATE = defineTemplate({
  id: 'email-account',
  nameKey: 'template.emailAccount',
  icon: 'mail',
  subtitleFieldKind: 'email',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('email', 'field.email'),
        single('password', 'field.password'),
        list('text', 'field.mailServers'),
        list('secret', 'field.backupCodes'),
        NOTES,
      ],
    },
  ],
});
