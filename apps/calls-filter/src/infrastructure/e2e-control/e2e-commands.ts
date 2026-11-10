import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { z } from 'zod';

import { CALL_SCREENING } from '../../../modules/call-screening/src/CallScreeningModule';
import type { IEditContext } from '../../contexts/grouping/application/GroupBookStore';
import type { TEditOutcome } from '../../contexts/grouping/domain/edit-outcome';
import type { TGroup } from '../../contexts/grouping/domain/group';
import { findGroup, freshColor } from '../../contexts/grouping/domain/group-book';
import { addMember, createGroup } from '../../contexts/grouping/domain/group-book-edits';
import { initialBook } from '../../contexts/grouping/domain/initial-book';
import type {
  INameMaskMember,
  INumberMaskMember,
  ISpecialMember,
} from '../../contexts/grouping/domain/member';
import { SPECIAL_MASKS } from '../../contexts/grouping/domain/member';
import type { IJournalEntry } from '../../contexts/journal/domain/journal-entry';
import { parseNameMask } from '../../contexts/masks/domain/name-mask';
import { parseNumberMask } from '../../contexts/masks/domain/number-mask';
import type { TPlaceId } from '../../contexts/policy/domain/place-rule';
import { isPlaceRadius } from '../../contexts/policy/domain/place-rule';
import type { IPolicy } from '../../contexts/policy/domain/policy';
import { ALWAYS_BLOCK, ALWAYS_PASS, withConditions } from '../../contexts/policy/domain/policy';
import type { TRepeatPass } from '../../contexts/policy/domain/repeat-pass';
import { REPEAT_OFF } from '../../contexts/policy/domain/repeat-pass';
import type { CallsFilterApp } from '../../contexts/shell/application/CallsFilterApp';
import { LIBPHONENUMBER_NUMBERING } from '../libphonenumber-numbering';
import { nativeCallJournal } from '../native-call-journal';

const EVENT_FILTER = {
  skipDeclined: true,
  includeAllDay: false,
  minutesBefore: 0,
  minutesAfter: 0,
};

const repeat = z.enum(['off', 'always']);

const newGroup = z.object({
  name: z.string().min(1),
  action: z.enum(['block', 'pass']),
  numbers: z.array(z.string()).default([]),
  specials: z.array(z.enum(SPECIAL_MASKS)).default([]),
  /** Name masks over any name the call carries. */
  names: z.array(z.string()).default([]),
  repeat: repeat.default('off'),
  /** «Let through only at this place, block elsewhere». */
  onlyAt: z
    .object({
      id: z.string(),
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().refine(isPlaceRadius),
    })
    .optional(),
  /** «Let through except during this phone calendar's events, block during them». */
  exceptDuring: z
    .object({ accountType: z.string(), accountName: z.string(), calendarName: z.string() })
    .optional(),
});

const e2eCommand = z.discriminatedUnion('name', [
  z.object({ name: z.literal('ping') }),
  z.object({ name: z.literal('reset') }),
  z.object({ name: z.literal('create-group'), group: newGroup }),
  z.object({ name: z.literal('group'), groupName: z.string() }),
  z.object({ name: z.literal('set-filter-repeat'), repeat }),
  z.object({ name: z.literal('calls'), number: z.string() }),
  /** A call the emulator's modem cannot make: one that comes with the name the network sent. */
  z.object({ name: z.literal('screen-call'), number: z.string(), networkName: z.string() }),
  z.object({ name: z.literal('device-calendars') }),
  z.object({ name: z.literal('journal-days') }),
  /** What a geofence would have said: the emulator's own location is too slow to drive a test. */
  z.object({ name: z.literal('set-at-place'), place: z.string(), inside: z.boolean().nullable() }),
]);

type TNewGroup = z.infer<typeof newGroup>;

const repeatPassOf = (kind: z.infer<typeof repeat>): TRepeatPass =>
  kind === 'always' ? { kind: 'always' } : REPEAT_OFF;

function policyOf(group: TNewGroup): IPolicy {
  const base = group.action === 'block' ? ALWAYS_BLOCK : ALWAYS_PASS;
  const policy: IPolicy = { ...base, repeatPass: repeatPassOf(group.repeat) };
  const { onlyAt, exceptDuring } = group;
  if (onlyAt === undefined && exceptDuring === undefined) {
    return policy;
  }
  return withConditions(policy, {
    schedule: null,
    calendars:
      exceptDuring === undefined
        ? []
        : [
            {
              source: { kind: 'device', ...exceptDuring },
              mode: 'except-events',
              filter: EVENT_FILTER,
            },
          ],
    places:
      onlyAt === undefined
        ? []
        : [{ ...onlyAt, id: onlyAt.id as TPlaceId, mode: 'only-at' as const }],
  });
}

function numberMember(source: string, context: IEditContext): INumberMaskMember {
  const mask = parseNumberMask(source);
  assert(mask.ok, `${source} is no number mask`);
  return {
    kind: 'number-mask',
    id: context.newMemberId(),
    mask: mask.value,
    note: '',
    updatedAt: context.now,
    excludedFor: null,
  };
}

function nameMember(source: string, context: IEditContext): INameMaskMember {
  const mask = parseNameMask(source);
  assert(mask.ok, `${source} is no name mask`);
  return {
    kind: 'name-mask',
    id: context.newMemberId(),
    mask: mask.value,
    field: 'any',
    note: '',
    updatedAt: context.now,
    excludedFor: null,
  };
}

function specialMember(special: ISpecialMember['special'], context: IEditContext): ISpecialMember {
  return {
    kind: 'special',
    id: context.newMemberId(),
    special,
    updatedAt: context.now,
    excludedFor: null,
  };
}

/** A group as the tests read it: plain JSON, masks as written, each place with what the phone knows of it. */
function described(app: CallsFilterApp, group: TGroup) {
  return {
    id: group.id,
    kind: group.kind,
    name: group.kind === 'custom' ? group.name : null,
    color: group.color,
    include:
      group.kind === 'custom'
        ? group.include.map(member => {
            switch (member.kind) {
              case 'number-mask':
              case 'name-mask':
                return member.mask.source;
              case 'special':
                return `special:${member.special}`;
              case 'contact':
                return `contact:${member.displayName}`;
              default:
                return assertNever(member);
            }
          })
        : [],
    action: group.policy.action,
    repeat: group.policy.repeatPass.kind,
    conditions:
      group.policy.conditions === null
        ? null
        : {
            repeat: group.policy.conditions.schedule?.repeat ?? null,
            zone: group.policy.conditions.schedule?.zone ?? null,
            calendars: group.policy.conditions.calendars.map(rule => rule.source.kind),
            places: group.policy.conditions.places.map(place => ({
              name: place.name,
              radius: place.radius,
              mode: place.mode,
              here: app.places.atPlace(place.id),
            })),
          },
  };
}

const NOT_A_DIGIT = /\D/g;
const JOURNAL_LOOKBACK_HOURS = 6;
const JOURNAL_LIMIT = 500;
const SERVICE_JOURNAL = nativeCallJournal(LIBPHONENUMBER_NUMBERING);

/** The service's verdict on a call and the group it went to, by name («strangers» for the special two). */
function screenedAs(app: CallsFilterApp, entry: IJournalEntry) {
  if (entry.outcome.kind !== 'screened') {
    return { verdict: null, group: null };
  }
  const group = findGroup(app.books.book, entry.outcome.groupAtCall);
  return {
    verdict: entry.outcome.verdict,
    group: group === null ? null : group.kind === 'custom' ? group.name : group.kind,
  };
}

function groupNamed(app: CallsFilterApp, name: string): TGroup {
  const group = app.books.book.groups.find(
    candidate => candidate.kind === 'custom' && candidate.name === name
  );
  assert(group !== undefined, `no group «${name}»`);
  return group;
}

function addGroup(app: CallsFilterApp, group: TNewGroup) {
  const id = app.newGroupId();
  const outcome = app.books.run((book, context) => {
    const created = createGroup(book, {
      id,
      name: group.name,
      color: freshColor(book),
      policy: policyOf(group),
      now: context.now,
    });
    assert(created.kind === 'applied', 'a new group is always applied');
    const members = [
      ...group.numbers.map(source => numberMember(source, context)),
      ...group.specials.map(special => specialMember(special, context)),
      ...group.names.map(source => nameMember(source, context)),
    ];
    return members.reduce<TEditOutcome>(
      (outcome, member) =>
        outcome.kind === 'applied'
          ? addMember(outcome.book, {
              group: id,
              side: 'include',
              member,
              newMemberId: context.newMemberId,
              now: context.now,
              facts: context.facts,
            })
          : outcome,
      created
    );
  });
  assert(outcome === 'applied', `«${group.name}» was not created: ${JSON.stringify(outcome)}`);
  return { id };
}

/**
 * What the e2e tests may ask of the app: seed the book, flip a switch, read what the screens and
 * the service would show. Every change goes through the same edits the screens use, so the
 * ruleset the service runs is published exactly as after a tap.
 */
export async function runE2eCommand(app: CallsFilterApp, input: unknown): Promise<unknown> {
  const command = e2eCommand.parse(input);
  switch (command.name) {
    case 'ping':
      return { ready: true };
    case 'reset':
      app.books.replace(initialBook(app.clock.now()));
      app.device.setRepeatPass(REPEAT_OFF);
      app.dismissWhereTo();
      return { groups: app.books.book.groups.length };
    case 'create-group': {
      const created = addGroup(app, command.group);
      // A new place starts a measurement of its own; the test's place facts come after it.
      await app.places.whenSettled();
      return created;
    }
    case 'group':
      return described(app, groupNamed(app, command.groupName));
    case 'set-filter-repeat':
      app.device.setRepeatPass(repeatPassOf(command.repeat));
      return { repeat: command.repeat };
    case 'calls': {
      // The service's journal alone: what a test waits for is the service's answer, and merging
      // in Android's call history (as the screens do) costs half a second a read.
      const since = app.clock.now().subtract({ hours: JOURNAL_LOOKBACK_HOURS });
      const entries = await SERVICE_JOURNAL.since(since, JOURNAL_LIMIT);
      const digits = command.number.replace(NOT_A_DIGIT, '');
      return entries
        .filter(entry => entry.caller.number === digits)
        .map(entry => ({ at: entry.at.toString(), ...screenedAs(app, entry) }));
    }
    case 'device-calendars':
      await app.calendars.refresh(true);
      return app.calendars.deviceCalendars.map(calendar => ({
        accountType: calendar.accountType,
        accountName: calendar.accountName,
        calendarName: calendar.calendarName,
      }));
    case 'set-at-place':
      await app.places.whenSettled();
      CALL_SCREENING.setAtPlace(command.place, command.inside);
      app.places.refresh();
      return { place: command.place, inside: command.inside };
    case 'journal-days':
      return { days: CALL_SCREENING.retentionDays() };
    case 'screen-call':
      return { verdict: await CALL_SCREENING.screenE2eCall(command.number, command.networkName) };
    default:
      return assertNever(command);
  }
}
