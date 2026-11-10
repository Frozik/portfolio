import type { TCalendarSource } from '../../calendars/domain/calendar-source';
import type { TGroupId } from '../../grouping/domain/group';
import type { TMemberId, TNameField, TSpecialMask } from '../../grouping/domain/member';
import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { TAction } from '../../policy/domain/action';
import type { TFloatingMinute } from '../../policy/domain/floating-time';
import type { IPlaceRule } from '../../policy/domain/place-rule';
import type { IEventFilter } from '../../policy/domain/policy';
import type { TWindowSet } from '../../policy/domain/window-set';

/** The published language's version: Kotlin treats a ruleset of another major as absent. */
export const RULESET_SCHEMA = 1;

export type TCompiledMember =
  | { readonly kind: 'number'; readonly id: TMemberId; readonly regex: string }
  | {
      readonly kind: 'name';
      readonly id: TMemberId;
      readonly regex: string;
      readonly field: TNameField;
    }
  | { readonly kind: 'special'; readonly id: TMemberId; readonly special: TSpecialMask }
  | {
      readonly kind: 'contact';
      readonly id: TMemberId;
      readonly numbers: readonly string[];
      readonly lookupKey: string;
    };

export interface ICompiledCalendarRule {
  readonly mode: 'except-events' | 'only-during-events';
  readonly filter: IEventFilter;
  readonly source: TCalendarSource;
  readonly bakedEvents: TWindowSet;
}

export interface ICompiledConditions {
  /** The zone whose clock `windows` are on; `null` for the phone's own. */
  readonly zone: string | null;
  readonly hasSchedule: boolean;
  readonly windows: TWindowSet;
  readonly calendars: readonly ICompiledCalendarRule[];
  /** Places by id: the service asks its geofence state for each. */
  readonly places: readonly IPlaceRule[];
}

export type TCompiledRepeatPass =
  | { readonly kind: 'off' }
  | { readonly kind: 'always' }
  | { readonly kind: 'until'; readonly untilEpochMs: number };

export interface ICompiledGroup {
  readonly id: TGroupId;
  readonly kind: 'custom' | 'my-contacts' | 'strangers';
  readonly include: readonly TCompiledMember[];
  readonly exclude: readonly TCompiledMember[];
  readonly excludeMyContacts: boolean;
  readonly action: TAction;
  readonly conditions: ICompiledConditions | null;
  readonly repeatWindowMinutes: number;
  readonly repeatPass: TCompiledRepeatPass;
  /** Switched off by the user: passed over in finding a caller's group. */
  readonly off: boolean;
  readonly createdAtEpochMs: number;
  readonly autoReplyText: string;
  /** A custom group's name, for the shade; empty for the special two. */
  readonly name: string;
}

/** The book as the screening service executes it: masks as regexes, schedules as windows. */
export interface ICompiledRuleset {
  readonly schema: number;
  readonly compiledAtEpochMs: number;
  readonly horizonEnd: TFloatingMinute;
  readonly homeCountry: TCountryCode;
  readonly groups: readonly ICompiledGroup[];
  /** The groups the shade offers after a stranger's call rang through; empty when the user turned it off. */
  readonly whereTo: readonly IWhereToChoice[];
  readonly repeatPass: TCompiledRepeatPass;
}

export interface IWhereToChoice {
  readonly id: TGroupId;
  readonly name: string;
}
