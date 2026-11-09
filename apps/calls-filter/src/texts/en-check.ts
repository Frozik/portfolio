import type { ITexts } from './texts';

/** «Check a number»: what would happen to a caller right now, and why. */
export const EN_CHECK: ITexts['check'] = {
  title: 'Check a number',
  open: 'Check a number',
  number: 'Number',
  numberPlaceholder: '+31 6 12345678',
  networkName: 'Name the operator sends, if any',
  hidden: 'Hidden number',
  hint: 'What happens if this number calls now, by the same rules the filter uses',
  noNumber: 'This is not a phone number',
  contact: name => `In your contacts as ${name}`,
  conflict: groups => `Also matches ${groups} — a conflict: the gentler group answers`,
};
