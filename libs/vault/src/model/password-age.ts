import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import type { ICardState, IVaultCard } from './card';
import { allFields, fieldValues, MAX_CARD_HISTORY, valuesInUse } from './card';
import type { TExpiryStatus } from './expiry';

/** A password unchanged for a year is old, unless its field sets a period of its own. */
export const OLD_PASSWORD_DAYS = 365;
/** A password due for a change is announced this long before. */
export const ROTATION_WARNING_DAYS = 7;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** The periods the editor offers; an imported period keeps its own value. */
export const ROTATION_PERIODS_DAYS = [30, 90, 180, 365] as const;

export type TPasswordsOf = (card: ICardState) => readonly string[];

const allPasswords: TPasswordsOf = card =>
  allFields(card)
    .filter(field => field.spec.kind === 'password')
    .flatMap(valuesInUse);

function samePasswords(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

/**
 * The earliest stamp at which the card already had its current passwords,
 * as far as its history reaches (the last twenty versions are kept);
 * a card whose whole history shows no other password counts from its
 * creation — unless the history is full, when the change may have fallen off it.
 */
export function passwordSetAtMs(
  card: IVaultCard,
  passwordsOf: TPasswordsOf = allPasswords
): number {
  const current = passwordsOf(card);
  let since = card.updatedAt.wallMs;
  for (const revision of card.history) {
    if (!samePasswords(passwordsOf(revision.snapshot), current)) {
      return since;
    }
    since = revision.at.wallMs;
  }
  return card.history.length >= MAX_CARD_HISTORY ? since : Math.min(since, card.createdAt.wallMs);
}

/** The shortest period a password field of the card asks to be changed in, if any does. */
export function rotationPeriodDays(card: ICardState): number | null {
  const periods = allFields(card).flatMap(field =>
    field.spec.kind === 'password' &&
    !isNil(field.spec.rotateEveryDays) &&
    fieldValues(field).length > 0
      ? [field.spec.rotateEveryDays]
      : []
  );
  return periods.length === 0 ? null : Math.min(...periods);
}

/**
 * The day the passwords are due for a change: counted in whole
 * days from now, so the date needs no time zone beyond the one `today` is in.
 */
export function rotationDueOn(
  card: IVaultCard,
  today: Temporal.PlainDate,
  nowMs: number
): Temporal.PlainDate | null {
  const period = rotationPeriodDays(card);
  if (isNil(period)) {
    return null;
  }
  const elapsedDays = Math.floor((nowMs - passwordSetAtMs(card)) / MS_PER_DAY);
  return today.add({ days: period - elapsedDays });
}

/** The expiry mechanism for a password's period: due soon a week ahead, `expired` once past. */
export function rotationStatus(
  due: Temporal.PlainDate | null,
  today: Temporal.PlainDate
): TExpiryStatus {
  if (isNil(due)) {
    return 'none';
  }
  const daysLeft = due.since(today).days;
  if (daysLeft < 0) {
    return 'expired';
  }
  return daysLeft <= ROTATION_WARNING_DAYS ? 'soon' : 'ok';
}
