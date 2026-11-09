import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

/**
 * «A repeat rings»: when a rule blocks, a second call from the same number within the group's
 * window rings anyway. Off, on for good, or on until a moment.
 */
export type TRepeatPass =
  | { readonly kind: 'off' }
  | { readonly kind: 'always' }
  | { readonly kind: 'until'; readonly until: Temporal.Instant };

export const REPEAT_OFF: TRepeatPass = { kind: 'off' };

export function isRepeatPassOn(repeat: TRepeatPass, now: Temporal.Instant): boolean {
  switch (repeat.kind) {
    case 'off':
      return false;
    case 'always':
      return true;
    case 'until':
      return now.epochMilliseconds < repeat.until.epochMilliseconds;
    default:
      return assertNever(repeat);
  }
}
