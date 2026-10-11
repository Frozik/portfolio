import { defineTemplate } from './template';

export const BLANK_TEMPLATE = defineTemplate({
  id: 'blank',
  nameKey: 'template.blank',
  icon: 'key',
  subtitleFieldKind: null,
  tabs: [{ titleKey: null, fields: [] }],
});
