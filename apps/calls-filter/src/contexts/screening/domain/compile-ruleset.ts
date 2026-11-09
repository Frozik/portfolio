import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { TGroup } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type { TMember } from '../../grouping/domain/member';
import { canonicalNumberPattern } from '../../masks/domain/number-mask-canonical';
import { patternRegexSource } from '../../masks/domain/pattern-regex';
import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { TFloatingMinute } from '../../policy/domain/floating-time';
import { floatingDateStart } from '../../policy/domain/floating-time';
import type { ITemporaryPolicy } from '../../policy/domain/policy';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import type { TScheduleTime } from '../../policy/domain/schedule';
import { scheduleWindows } from '../../policy/domain/schedule-windows';
import type {
  ICompiledGroup,
  ICompiledRuleset,
  TCompiledRepeatPass,
  IWhereToChoice,
  ICompiledScheduled,
  ICompiledTemporary,
  ICompiledTimeOfDay,
  TCompiledMember,
} from './compiled-ruleset';
import { RULESET_SCHEMA } from './compiled-ruleset';
import type { IScreeningInputs } from './screening-inputs';

const MINUTES_PER_HOUR = 60;

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

function minuteOfDay(time: Temporal.PlainTime): number {
  return time.hour * MINUTES_PER_HOUR + time.minute;
}

function compileTime(time: TScheduleTime): ICompiledTimeOfDay {
  switch (time.kind) {
    case 'all-day':
      return { allDay: true, fromMinuteOfDay: 0, toMinuteOfDay: 0 };
    case 'range':
      return {
        allDay: false,
        fromMinuteOfDay: minuteOfDay(time.from),
        toMinuteOfDay: minuteOfDay(time.to),
      };
    default:
      return assertNever(time);
  }
}

function compileScheduled(group: TGroup, inputs: IScreeningInputs): ICompiledScheduled | null {
  const { scheduled } = group.policy;
  if (scheduled === null) {
    return null;
  }
  const { schedule } = scheduled;
  return {
    action: scheduled.action,
    zone: schedule?.zone.kind === 'fixed' ? schedule.zone.zone : null,
    hasSchedule: schedule !== null,
    windows: schedule === null ? [] : scheduleWindows(schedule, inputs.occurrencesOf(schedule)),
    times: schedule === null ? [] : schedule.times.map(compileTime),
    holidays: schedule?.holidays ?? null,
    calendars: scheduled.calendars.map(rule => ({
      mode: rule.mode,
      filter: rule.filter,
      source: rule.source,
      bakedEvents: rule.source.kind === 'holidays-here' ? [] : inputs.eventsOf(rule),
    })),
    places: scheduled.places,
  };
}

function compileTemporary(temporary: ITemporaryPolicy | null): ICompiledTemporary | null {
  if (temporary === null) {
    return null;
  }
  const { until } = temporary;
  const untilEpochMs =
    until.kind === 'first-pass' ? until.latest.epochMilliseconds : until.at.epochMilliseconds;
  return {
    action: temporary.action,
    until: until.kind,
    untilEpochMs,
    setAtEpochMs: temporary.setAt.epochMilliseconds,
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
    otherwise: group.policy.otherwise,
    scheduled: compileScheduled(group, inputs),
    repeatWindowMinutes: group.policy.repeatWindowMinutes,
    repeatPass: compileRepeatPass(group.policy.repeatPass),
    temporary: compileTemporary(group.temporary),
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
  const holidays = new Map(
    [...inputs.holidaysByCountry].map(
      ([country, dates]): [TCountryCode, readonly TFloatingMinute[]] => [
        country,
        dates.map(floatingDateStart),
      ]
    )
  );
  return {
    schema: RULESET_SCHEMA,
    compiledAtEpochMs: compiledAt.epochMilliseconds,
    horizonEnd: floatingDateStart(inputs.horizonEnd.add({ days: 1 })),
    homeCountry: environment.home.country,
    groups: book.groups.map(group => compileGroup(group, environment, inputs)),
    holidays,
    whereTo,
    repeatPass: compileRepeatPass(repeatPass),
  };
}
