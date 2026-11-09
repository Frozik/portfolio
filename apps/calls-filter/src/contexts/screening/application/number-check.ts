import { maxBy } from 'lodash-es';

import type { GroupBook } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type { IJournalEntry } from '../../journal/domain/journal-entry';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import { normalizeName } from '../../phone/domain/name-normalization';
import type { IPhoneNumbering } from '../../phone/domain/ports/phone-numbering';
import type { IMoment } from '../../policy/domain/action-now';
import type { TPlaceFacts } from '../../policy/domain/place-rule';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { decide } from '../domain/decide';
import type { IDecision } from '../domain/decision';
import type { IScreeningInputs } from '../domain/screening-inputs';

/** A caller as the user describes one: a number (or a hidden one) and the name the operator sends. */
export interface INumberQuery {
  readonly number: string;
  readonly networkName: string;
  readonly hidden: boolean;
}

/** What the app knows right now, the same facts the published ruleset carries. */
export interface INumberCheckContext {
  readonly book: GroupBook;
  readonly environment: IMatchingEnvironment;
  readonly inputs: IScreeningInputs;
  readonly paused: boolean;
  readonly repeatPass: TRepeatPass;
  readonly atPlace: TPlaceFacts;
  readonly moment: IMoment;
  readonly numbering: IPhoneNumbering;
  /** Every caller the app has met, contacts among them: a number in the address book is a contact. */
  readonly knownCallers: readonly ICaller[];
  readonly journal: readonly IJournalEntry[];
}

export type TNumberCheck =
  | { readonly kind: 'no-number' }
  | { readonly kind: 'decided'; readonly caller: ICaller; readonly decision: IDecision };

const REJECTING_VERDICTS = new Set(['rejected', 'awaiting-repeat']);

function lastRejectedAt(journal: readonly IJournalEntry[], number: TE164Digits | null) {
  if (number === null) {
    return null;
  }
  const rejected = journal.filter(
    entry =>
      entry.caller.number === number &&
      entry.outcome.kind === 'screened' &&
      REJECTING_VERDICTS.has(entry.outcome.verdict)
  );
  return maxBy(rejected, entry => entry.at.epochMilliseconds)?.at ?? null;
}

function callerOf(query: INumberQuery, context: INumberCheckContext): ICaller | null {
  const trimmedName = query.networkName.trim();
  const networkName = trimmedName === '' ? null : normalizeName(trimmedName);
  if (query.hidden) {
    return { number: null, traits: null, networkName, contact: null };
  }
  const number = context.numbering.parse(query.number, context.environment.home.country);
  if (number === null) {
    return null;
  }
  const known = context.knownCallers.find(
    caller => caller.number === number && caller.contact !== null
  );
  return {
    number,
    traits: context.numbering.traits(number),
    networkName,
    contact: known?.contact ?? null,
  };
}

/** The service's answer to a caller at this moment, worked out by the same rules it uses. */
export function checkNumber(query: INumberQuery, context: INumberCheckContext): TNumberCheck {
  const caller = callerOf(query, context);
  if (caller === null) {
    return { kind: 'no-number' };
  }
  const decision = decide(context.book, caller, context.moment, {
    environment: context.environment,
    inputs: context.inputs,
    paused: context.paused,
    repeatPass: context.repeatPass,
    lastRejectedAt: lastRejectedAt(context.journal, caller.number),
    atPlace: context.atPlace,
  });
  return { kind: 'decided', caller, decision };
}
