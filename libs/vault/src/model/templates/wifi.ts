import { defineTemplate, NOTES, single } from './template';

export const WIFI_TEMPLATE = defineTemplate({
  id: 'wifi',
  nameKey: 'template.wifi',
  icon: 'wifi',
  subtitleFieldKind: 'text',
  tabs: [
    {
      titleKey: null,
      fields: [
        single('text', 'field.ssid'),
        single('password', 'field.password'),
        single('select', 'field.security', {
          kind: 'select',
          options: ['option.wpa3', 'option.wpa2', 'option.wpa', 'option.wep', 'option.open'],
          allowCustom: false,
        }),
        single('boolean', 'field.hiddenNetwork'),
        NOTES,
      ],
    },
  ],
});
