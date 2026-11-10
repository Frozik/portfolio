import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TJournalOutcome } from '../../contexts/journal/domain/journal-entry';

/** One word per outcome, the list's glyph and the testID suffix tests read instead of text. */
export type TCallState =
  | 'passed'
  | 'rejected'
  | 'awaiting-repeat'
  | 'passed-as-repeat'
  | 'paused'
  | 'history-missed'
  | 'history-answered'
  | 'history-blocked';

export function callState(outcome: TJournalOutcome): TCallState {
  switch (outcome.kind) {
    case 'screened':
      return outcome.verdict;
    case 'history':
      switch (outcome.type) {
        case 'incoming':
          return 'history-answered';
        case 'missed':
          return 'history-missed';
        case 'rejected':
        case 'blocked':
          return 'history-blocked';
        default:
          return assertNever(outcome.type);
      }
    default:
      return assertNever(outcome);
  }
}

export const CALL_GLYPHS: Readonly<Record<TCallState, string>> = {
  passed: '✅',
  rejected: '⛔',
  'awaiting-repeat': '🔁',
  'passed-as-repeat': '🔁✅',
  paused: '⏸',
  'history-answered': '↙',
  'history-missed': '↙',
  'history-blocked': '⛔',
};

/**
 * The ring around a call's avatar: red when it was turned away, blue when it rang and nobody
 * answered, green when it rang and was answered — or the phone has not said yet.
 */
export function callRing(
  state: TCallState,
  answered: boolean | null
): 'positive' | 'danger' | 'accent' {
  switch (state) {
    case 'rejected':
    case 'awaiting-repeat':
    case 'history-blocked':
      return 'danger';
    case 'passed':
    case 'passed-as-repeat':
    case 'paused':
    case 'history-answered':
    case 'history-missed':
      return answered === false ? 'accent' : 'positive';
    default:
      return assertNever(state);
  }
}
