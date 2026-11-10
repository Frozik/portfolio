import { create, toBinary } from '@bufbuild/protobuf';
import {
  Action,
  CalendarMode,
  CalendarRuleSchema,
  ConditionsSchema,
  ContactMatchSchema,
  DeviceCalendarSchema,
  EventFilterSchema,
  GroupChoiceSchema,
  GroupKind,
  GroupSchema,
  MemberSchema,
  NameField,
  NameMatchSchema,
  PlaceMode,
  PlaceRuleSchema,
  PolicySchema,
  RepeatPassKind,
  RepeatPassSchema,
  RulesetSchema,
  SpecialMask,
  WindowSchema,
} from '@frozik/proto/frozik/callsfilter/v1/ruleset_pb';
import type { CalendarRule, Member, Window } from '@frozik/proto/frozik/callsfilter/v1/ruleset_pb';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TCalendarSource } from '../contexts/calendars/domain/calendar-source';
import type { TNameField, TSpecialMask } from '../contexts/grouping/domain/member';
import type { TAction } from '../contexts/policy/domain/action';
import type { TWindowSet } from '../contexts/policy/domain/window-set';
import type {
  ICompiledCalendarRule,
  ICompiledGroup,
  ICompiledRuleset,
  TCompiledRepeatPass,
  TCompiledMember,
} from '../contexts/screening/domain/compiled-ruleset';

function wireAction(action: TAction): Action {
  switch (action) {
    case 'block':
      return Action.BLOCK;
    case 'pass':
      return Action.PASS;
    default:
      return assertNever(action);
  }
}

function wireField(field: TNameField): NameField {
  switch (field) {
    case 'network':
      return NameField.NETWORK;
    case 'contact':
      return NameField.CONTACT;
    case 'any':
      return NameField.ANY;
    default:
      return assertNever(field);
  }
}

function wireSpecial(special: TSpecialMask): SpecialMask {
  switch (special) {
    case 'hidden':
      return SpecialMask.HIDDEN;
    case 'foreign':
      return SpecialMask.FOREIGN;
    case 'premium-rate':
      return SpecialMask.PREMIUM_RATE;
    case 'voip':
      return SpecialMask.VOIP;
    case 'toll-free':
      return SpecialMask.TOLL_FREE;
    default:
      return assertNever(special);
  }
}

function wireWindows(windows: TWindowSet): Window[] {
  return windows.map(window =>
    create(WindowSchema, { fromMinute: BigInt(window.from), toMinute: BigInt(window.to) })
  );
}

function wireMember(member: TCompiledMember): Member {
  switch (member.kind) {
    case 'number':
      return create(MemberSchema, {
        id: member.id,
        kind: { case: 'numberRegex', value: member.regex },
      });
    case 'name':
      return create(MemberSchema, {
        id: member.id,
        kind: {
          case: 'name',
          value: create(NameMatchSchema, { regex: member.regex, field: wireField(member.field) }),
        },
      });
    case 'special':
      return create(MemberSchema, {
        id: member.id,
        kind: { case: 'special', value: wireSpecial(member.special) },
      });
    case 'contact':
      return create(MemberSchema, {
        id: member.id,
        kind: {
          case: 'contact',
          value: create(ContactMatchSchema, {
            numbers: [...member.numbers],
            lookupKey: member.lookupKey,
          }),
        },
      });
    default:
      return assertNever(member);
  }
}

function wireSource(source: TCalendarSource): CalendarRule['source'] {
  switch (source.kind) {
    case 'device':
      return {
        case: 'device',
        value: create(DeviceCalendarSchema, {
          accountType: source.accountType,
          accountName: source.accountName,
          calendarName: source.calendarName,
        }),
      };
    case 'ics':
      return { case: 'icsId', value: source.id };
    default:
      return assertNever(source);
  }
}

function wireCalendarRule(rule: ICompiledCalendarRule): CalendarRule {
  return create(CalendarRuleSchema, {
    mode:
      rule.mode === 'except-events' ? CalendarMode.EXCEPT_EVENTS : CalendarMode.ONLY_DURING_EVENTS,
    filter: create(EventFilterSchema, rule.filter),
    source: wireSource(rule.source),
    bakedEvents: wireWindows(rule.bakedEvents),
  });
}

function wireKind(kind: ICompiledGroup['kind']): GroupKind {
  switch (kind) {
    case 'custom':
      return GroupKind.CUSTOM;
    case 'my-contacts':
      return GroupKind.MY_CONTACTS;
    case 'strangers':
      return GroupKind.STRANGERS;
    default:
      return assertNever(kind);
  }
}

function wireRepeatPass(repeat: TCompiledRepeatPass) {
  switch (repeat.kind) {
    case 'off':
      return create(RepeatPassSchema, { kind: RepeatPassKind.OFF });
    case 'always':
      return create(RepeatPassSchema, { kind: RepeatPassKind.ALWAYS });
    case 'until':
      return create(RepeatPassSchema, {
        kind: RepeatPassKind.UNTIL,
        untilEpochMs: BigInt(repeat.untilEpochMs),
      });
    default:
      return assertNever(repeat);
  }
}

function wireGroup(group: ICompiledGroup) {
  const { conditions } = group;
  return create(GroupSchema, {
    id: group.id,
    kind: wireKind(group.kind),
    include: group.include.map(wireMember),
    exclude: group.exclude.map(wireMember),
    excludeMyContacts: group.excludeMyContacts,
    policy: create(PolicySchema, {
      action: wireAction(group.action),
      repeatWindowMinutes: group.repeatWindowMinutes,
      repeatPass: wireRepeatPass(group.repeatPass),
      conditions:
        conditions === null
          ? undefined
          : create(ConditionsSchema, {
              zone: conditions.zone ?? '',
              hasSchedule: conditions.hasSchedule,
              windows: wireWindows(conditions.windows),
              calendars: conditions.calendars.map(wireCalendarRule),
              places: conditions.places.map(place =>
                create(PlaceRuleSchema, {
                  id: place.id,
                  mode: place.mode === 'only-at' ? PlaceMode.ONLY_AT : PlaceMode.EXCEPT_AT,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  radiusMeters: place.radius,
                })
              ),
            }),
    }),
    off: group.off,
    createdAtEpochMs: BigInt(group.createdAtEpochMs),
    autoReplyText: group.autoReplyText,
    name: group.name,
  });
}

/** The compiled ruleset as the bytes of the published language. */
export function encodeRuleset(ruleset: ICompiledRuleset): Uint8Array {
  return toBinary(
    RulesetSchema,
    create(RulesetSchema, {
      schema: ruleset.schema,
      compiledAtEpochMs: BigInt(ruleset.compiledAtEpochMs),
      horizonEndMinute: BigInt(ruleset.horizonEnd),
      homeCountry: ruleset.homeCountry,
      groups: ruleset.groups.map(wireGroup),
      whereTo: ruleset.whereTo.map(choice => create(GroupChoiceSchema, choice)),
      repeatPass: wireRepeatPass(ruleset.repeatPass),
    })
  );
}
