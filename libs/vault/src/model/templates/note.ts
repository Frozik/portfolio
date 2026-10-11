import { defineTemplate, NOTES } from './template';

export const NOTE_TEMPLATE = defineTemplate({
  id: 'note',
  nameKey: 'template.note',
  icon: 'sticky-note',
  subtitleFieldKind: null,
  tabs: [{ titleKey: null, fields: [NOTES] }],
});
