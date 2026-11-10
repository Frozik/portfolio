import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { TGroup } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type { TMember } from '../../grouping/domain/member';
import { canonicalNumberPattern } from '../../masks/domain/number-mask-canonical';
import { patternRegexSource } from '../../masks/domain/pattern-regex';
import { floatingDateStart } from '../../policy/domain/floating-time';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { scheduleWindows } from '../../policy/domain/schedule-windows';
import type {
  ICompiledGroup,
  ICompiledRuleset,
  TCompiledRepeatPass,
  IWhereToChoice,
  ICompiledConditions,
  TCompiledMember,
} from './compiled-ruleset';
import { RULESET_SCHEMA } from './compiled-ruleset';
import type { IScreeningInputs } from './screening-inputs';

function compileMember(member: TMember, environment: IMatchingEnvironment): TCompiledMember | null {
  switch (member.kind) {
    case 'number-mask': {
      const canonical = canonicalNumberPattern(member.mask, environment.home);
      return canonical.ok
        ? { kind: 'number', id: member.id, regex: patternRegexSource(canonical.value, 'digits') }
        : null;
    }
    case 'name-mask':
      return {
        kind: 'name',
        id: member.id,
        regex: patternRegexSource(member.mask.pattern, 'text'),
        field: member.field,
      };
    case 'special':
      return { kind: 'special', id: member.id, special: member.special };
    case 'contact':
      return {
        kind: 'contact',
        id: member.id,
        numbers: member.numbers,
        lookupKey: member.lookupKey ?? '',
      };
    default:
      return assertNever(member);
  }
}

function compileMembers(
  members: readonly TMember[],
  environment: IMatchingEnvironment
): readonly TCompiledMember[] {
  return members.flatMap(member => {
    const compiled = compileMember(member, environment);
    return compiled === null ? [] : [compiled];
  });
}

function compileConditions(group: TGroup, inputs: IScreeningInputs): ICompiledConditions | null {
  const { conditions } = group.policy;
  if (conditions === null) {
    return null;
  }
  const { schedule } = conditions;
  return {
    zone: schedule?.zone.kind === 'fixed' ? schedule.zone.zone : null,
    hasSchedule: schedule !== null,
    windows: schedule === null ? [] : scheduleWindows(schedule, inputs.occurrencesOf(schedule)),
    calendars: conditions.calendars.map(rule => ({
      mode: rule.mode,
      filter: rule.filter,
      source: rule.source,
      bakedEvents: inputs.eventsOf(rule),
    })),
    places: conditions.places,
  };
}

function compileRepeatPass(repeat: TRepeatPass): TCompiledRepeatPass {
  return repeat.kind === 'until'
    ? { kind: 'until', untilEpochMs: repeat.until.epochMilliseconds }
    : { kind: repeat.kind };
}

function compileGroup(
  group: TGroup,
  environment: IMatchingEnvironment,
  inputs: IScreeningInputs
): ICompiledGroup {
  return {
    id: group.id,
    kind: group.kind,
    include: group.kind === 'custom' ? compileMembers(group.include, environment) : [],
    exclude: group.kind === 'strangers' ? [] : compileMembers(group.exclude, environment),
    excludeMyContacts: group.kind === 'custom' && group.excludeMyContacts,
    action: group.policy.action,
    conditions: compileConditions(group, inputs),
    repeatWindowMinutes: group.policy.repeatWindowMinutes,
    repeatPass: compileRepeatPass(group.policy.repeatPass),
    off: !group.enabled,
    createdAtEpochMs: group.createdAt.epochMilliseconds,
    autoReplyText: group.autoReply?.text ?? '',
    name: group.kind === 'custom' ? group.name : '',
  };
}

/** The ruleset the screening service runs, for the horizon the inputs cover. */
/** What the ruleset needs beyond the book: where the phone is, what the calendars say, the phone's own switches. */
export interface IRulesetContext {
  readonly environment: IMatchingEnvironment;
  readonly inputs: IScreeningInputs;
  readonly compiledAt: Temporal.Instant;
  readonly whereTo: readonly IWhereToChoice[];
  readonly repeatPass: TRepeatPass;
}

export function compileRuleset(
  book: GroupBook,
  { environment, inputs, compiledAt, whereTo, repeatPass }: IRulesetContext
): ICompiledRuleset {
  return {
    schema: RULESET_SCHEMA,
    compiledAtEpochMs: compiledAt.epochMilliseconds,
    horizonEnd: floatingDateStart(inputs.horizonEnd.add({ days: 1 })),
    homeCountry: environment.home.country,
    groups: book.groups.map(group => compileGroup(group, environment, inputs)),
    whereTo,
    repeatPass: compileRepeatPass(repeatPass),
  };
}
