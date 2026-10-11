import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { ICardState } from './card';
import { allFields } from './card';
import { parsePlainDate } from './field-kinds/plain-date';
import { parseYearMonth } from './field-kinds/year-month';
import { templateOf } from './templates/registry';
import type { IVaultSettings } from './vault-document';

export type TExpiryStatus = 'none' | 'ok' | 'soon' | 'expired';

const EXPIRES_ON = new WeakMap<ICardState, Temporal.PlainDate | null>();

function fieldExpiry(kind: string, value: string): Temporal.PlainDate | null {
  if (kind === 'expiry-date') {
    return parsePlainDate(value);
  }
  const month = kind === 'expiry-month' ? parseYearMonth(value) : null;
  return isNil(month) ? null : month.toPlainDate({ day: month.daysInMonth });
}

function computeExpiresOn(card: ICardState): Temporal.PlainDate | null {
  let earliest: Temporal.PlainDate | null = null;
  for (const field of allFields(card)) {
    const date =
      field.value.cardinality === 'single' ? fieldExpiry(field.spec.kind, field.value.value) : null;
    if (!isNil(date) && (isNil(earliest) || Temporal.PlainDate.compare(date, earliest) < 0)) {
      earliest = date;
    }
  }
  return earliest;
}

/** The earliest expiry of the card: a card month counts to its last day. Cached per card object. */
export function expiresOn(card: ICardState): Temporal.PlainDate | null {
  if (!EXPIRES_ON.has(card)) {
    EXPIRES_ON.set(card, computeExpiresOn(card));
  }
  return EXPIRES_ON.get(card) ?? null;
}

/** The vault's setting for the template, else the template's own (a passport warns half a year ahead). */
export function warningDaysFor(card: ICardState, settings: IVaultSettings): number {
  return (
    settings.expiryWarningDays[card.templateId] ?? templateOf(card.templateId).expiryWarningDays
  );
}

/** Valid through the expiry day itself; "soon" from `warningDays` before it. */
export function expiryStatus(
  card: ICardState,
  today: Temporal.PlainDate,
  warningDays: number
): TExpiryStatus {
  const date = expiresOn(card);
  if (isNil(date)) {
    return 'none';
  }
  if (Temporal.PlainDate.compare(date, today) < 0) {
    return 'expired';
  }
  return Temporal.PlainDate.compare(date, today.add({ days: warningDays })) <= 0 ? 'soon' : 'ok';
}

/** KeePassXC's quick terms next to the date picker. */
export const EXPIRY_SHORTCUTS = {
  'month-1': { months: 1 },
  'month-3': { months: 3 },
  'year-1': { years: 1 },
  'year-5': { years: 5 },
  'year-10': { years: 10 },
} as const satisfies Record<string, Temporal.DurationLike>;

export type TExpiryShortcut = keyof typeof EXPIRY_SHORTCUTS;

export function expiryAfter(
  today: Temporal.PlainDate,
  shortcut: TExpiryShortcut
): Temporal.PlainDate {
  return today.add(EXPIRY_SHORTCUTS[shortcut]);
}
