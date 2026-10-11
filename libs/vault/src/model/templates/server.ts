import { defineTemplate, list, NOTES, single } from './template';

export const SERVER_TEMPLATE = defineTemplate({
  id: 'server',
  nameKey: 'template.server',
  icon: 'server',
  subtitleFieldKind: 'login',
  tabs: [
    {
      titleKey: 'tab.access',
      fields: [
        list('url', 'field.hosts'),
        single('login', 'field.login'),
        single('password', 'field.password'),
      ],
    },
    { titleKey: 'tab.keys', fields: [single('multiline', 'field.privateKey'), NOTES] },
  ],
});
