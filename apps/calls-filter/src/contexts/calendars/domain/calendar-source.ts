import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Brand } from '@frozik/utils/types/base';

export type TIcsId = Brand<string, 'IcsId'>;

/**
 * A calendar a rule looks at, named the way another phone can find it again: a device
 * calendar by account and calendar name, an iCal subscription by its id (the link itself
 * never leaves the phone), or the holidays of the country the phone is in.
 */
export type TCalendarSource =
  | {
      readonly kind: 'device';
      readonly accountType: string;
      readonly accountName: string;
      readonly calendarName: string;
    }
  | { readonly kind: 'ics'; readonly id: TIcsId }
  | { readonly kind: 'holidays-here' };

export function sameCalendarSource(left: TCalendarSource, right: TCalendarSource): boolean {
  switch (left.kind) {
    case 'device':
      return (
        right.kind === 'device' &&
        left.accountType === right.accountType &&
        left.accountName === right.accountName &&
        left.calendarName === right.calendarName
      );
    case 'ics':
      return right.kind === 'ics' && left.id === right.id;
    case 'holidays-here':
      return right.kind === 'holidays-here';
    default:
      return assertNever(left);
  }
}
