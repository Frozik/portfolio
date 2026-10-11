import { isNil } from 'lodash-es';

import { defineFieldKind, invalid, VALID } from './field-kind';
import { parseYearMonth } from './year-month';

/** Stored as `YYYY-MM`, typed and shown as `MM/YY`. */
export const EXPIRY_MONTH_FIELD = defineFieldKind({
  kind: 'expiry-month',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'expiry-month' },
  normalize: value => parseYearMonth(value)?.toString() ?? value.trim(),
  validate: value =>
    parseYearMonth(value)?.toString() === value ? VALID : invalid('month-format'),
  format: value => {
    const month = parseYearMonth(value);
    return isNil(month)
      ? value
      : `${String(month.month).padStart(2, '0')}/${String(month.year % 100).padStart(2, '0')}`;
  },
});
