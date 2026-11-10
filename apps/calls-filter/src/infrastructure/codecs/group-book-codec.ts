import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import type { TCalendarSource, TIcsId } from '../../contexts/calendars/domain/calendar-source';
import type { TGroup, TGroupId } from '../../contexts/grouping/domain/group';
import { COLOR_SLOTS } from '../../contexts/grouping/domain/group';
import type { TGroupColor } from '../../contexts/grouping/domain/group';
import type { GroupBook } from '../../contexts/grouping/domain/group-book';
import { groupBook } from '../../contexts/grouping/domain/group-book';
import { parseHexColor } from '../../contexts/grouping/domain/hex-color';
import type { TMember, TMemberId } from '../../contexts/grouping/domain/member';
import { SPECIAL_MASKS } from '../../contexts/grouping/domain/member';
import { parseNameMask } from '../../contexts/masks/domain/name-mask';
import { parseNumberMask } from '../../contexts/masks/domain/number-mask';
import type { TE164Digits } from '../../contexts/phone/domain/caller';
import type { TPlaceId } from '../../contexts/policy/domain/place-rule';
import { isPlaceRadius } from '../../contexts/policy/domain/place-rule';
import type { IPolicy, ITemporaryPolicy } from '../../contexts/policy/domain/policy';
import type { ISchedule, TWeekday } from '../../contexts/policy/domain/schedule';
import { BOOK_HISTORY } from './group-book-history';
import { repeatPassCodec } from './repeat-pass-codec';
import { openDocument, sealDocument } from './versioned-document';

const instant = z.string().transform(text => Temporal.Instant.from(text));
const plainDate = z.string().transform(text => Temporal.PlainDate.from(text));
const plainTime = z.string().transform(text => Temporal.PlainTime.from(text));
const action = z.enum(['block', 'pass']);

const weekday = z
  .number()
  .int()
  .min(1)
  .max(7)
  .transform(day => day as TWeekday);

const memberCore = { id: z.string(), updatedAt: instant, excludedFor: z.string().nullable() };
const member = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('number-mask'), source: z.string(), note: z.string(), ...memberCore }),
  z.object({
    kind: z.literal('name-mask'),
    source: z.string(),
    field: z.enum(['network', 'contact', 'any']),
    note: z.string(),
    ...memberCore,
  }),
  z.object({ kind: z.literal('special'), special: z.enum(SPECIAL_MASKS), ...memberCore }),
  z.object({
    kind: z.literal('contact'),
    displayName: z.string(),
    numbers: z.array(z.string()),
    lookupKey: z.string().nullable(),
    ...memberCore,
  }),
]);

const scheduleZone = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('here') }),
  z.object({ kind: z.literal('fixed'), zone: z.string().min(1) }),
]);

const schedule = z.object({
  /** Schedules written before zones existed followed the phone. */
  zone: scheduleZone.default({ kind: 'here' }),
  start: plainDate,
  times: z.array(
    z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('all-day') }),
      z.object({ kind: z.literal('range'), from: plainTime, to: plainTime }),
    ])
  ),
  repeat: z
    .object({
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      interval: z.number().int().min(1),
      weekdays: z.array(weekday),
      monthly: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('day-of-month'), day: z.number().int().min(1).max(31) }),
          z.object({
            kind: z.literal('nth-weekday'),
            nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
            weekday,
          }),
        ])
        .nullable(),
      end: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('never') }),
        z.object({ kind: z.literal('until'), date: plainDate }),
        z.object({ kind: z.literal('count'), count: z.number().int().min(1) }),
      ]),
    })
    .nullable(),
  exceptDates: z.array(plainDate),
});

const calendarSource = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('device'),
    accountType: z.string(),
    accountName: z.string(),
    calendarName: z.string(),
  }),
  z.object({ kind: z.literal('ics'), id: z.string() }),
  // Read only to drop: an older app offered the holidays of the phone's country as a calendar.
  z.object({ kind: z.literal('holidays-here') }),
]);

const placeRule = z.object({
  id: z
    .string()
    .min(1)
    .transform(id => id as TPlaceId),
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().refine(isPlaceRadius, 'not a place radius'),
  mode: z.enum(['only-at', 'except-at']),
});

const policy = z.object({
  otherwise: action,
  repeatPass: repeatPassCodec,
  repeatWindowMinutes: z.number().int().min(1),
  scheduled: z
    .object({
      schedule: schedule.nullable(),
      calendars: z.array(
        z.object({
          source: calendarSource,
          mode: z.enum(['except-events', 'only-during-events']),
          filter: z.object({
            skipDeclined: z.boolean(),
            includeAllDay: z.boolean(),
            minutesBefore: z.number().int().min(0),
            minutesAfter: z.number().int().min(0),
          }),
        })
      ),
      /** Documents from before places had none. */
      places: z.array(placeRule).default([]),
    })
    .nullable(),
});

const temporary = z
  .object({
    action,
    setAt: instant,
    until: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('instant'), at: instant }),
      z.object({ kind: z.literal('first-pass'), latest: instant }),
      z.object({ kind: z.literal('end-of-event'), at: instant }),
    ]),
  })
  .nullable();

const groupCore = {
  id: z.string(),
  color: z.union([
    z.enum(COLOR_SLOTS),
    z.string().transform((text, context): TGroupColor => {
      const hex = parseHexColor(text);
      if (hex === null) {
        context.addIssue({ code: 'custom', message: 'not a colour' });
        return z.NEVER;
      }
      return hex;
    }),
  ]),
  policy,
  temporary,
  autoReply: z.object({ text: z.string() }).nullable(),
  createdAt: instant,
  updatedAt: instant,
};

const group = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('custom'),
    name: z.string(),
    include: z.array(member),
    exclude: z.array(member),
    excludeMyContacts: z.boolean(),
    ...groupCore,
  }),
  z.object({ kind: z.literal('my-contacts'), exclude: z.array(member), ...groupCore }),
  z.object({ kind: z.literal('strangers'), ...groupCore }),
]);

const bookData = z.object({ groups: z.array(group) });

type TStoredMember = z.infer<typeof member>;
type TEncodedMember = z.input<typeof member>;

/** A stored mask is its source again: the parser makes the value, never the stored bytes. */
function memberOf(stored: TStoredMember): TMember | null {
  const core = {
    id: stored.id as TMemberId,
    updatedAt: stored.updatedAt,
    excludedFor: stored.excludedFor as TGroupId | null,
  };
  switch (stored.kind) {
    case 'number-mask': {
      const mask = parseNumberMask(stored.source);
      return mask.ok ? { kind: 'number-mask', mask: mask.value, note: stored.note, ...core } : null;
    }
    case 'name-mask': {
      const mask = parseNameMask(stored.source);
      return mask.ok
        ? { kind: 'name-mask', mask: mask.value, field: stored.field, note: stored.note, ...core }
        : null;
    }
    case 'special':
      return { kind: 'special', special: stored.special, ...core };
    case 'contact':
      return {
        kind: 'contact',
        displayName: stored.displayName,
        numbers: stored.numbers as TE164Digits[],
        lookupKey: stored.lookupKey,
        ...core,
      };
    default:
      return assertNever(stored);
  }
}

function membersOf(stored: readonly TStoredMember[]): readonly TMember[] {
  return stored.flatMap(item => {
    const decoded = memberOf(item);
    return decoded === null ? [] : [decoded];
  });
}

function sourceOf(stored: z.infer<typeof calendarSource>): TCalendarSource | null {
  switch (stored.kind) {
    case 'ics':
      return { kind: 'ics', id: stored.id as TIcsId };
    case 'device':
      return stored;
    case 'holidays-here':
      return null;
    default:
      return assertNever(stored);
  }
}

function policyOf(stored: z.infer<typeof policy>): IPolicy {
  return {
    ...stored,
    scheduled:
      stored.scheduled === null
        ? null
        : {
            ...stored.scheduled,
            schedule: stored.scheduled.schedule as ISchedule | null,
            calendars: stored.scheduled.calendars.flatMap(rule => {
              const source = sourceOf(rule.source);
              return source === null ? [] : [{ ...rule, source }];
            }),
          },
  };
}

function groupOf(stored: z.infer<typeof group>): TGroup {
  const core = {
    id: stored.id as TGroupId,
    color: stored.color,
    policy: policyOf(stored.policy),
    temporary: stored.temporary as ITemporaryPolicy | null,
    autoReply: stored.autoReply,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
  switch (stored.kind) {
    case 'custom':
      return {
        kind: 'custom',
        name: stored.name,
        include: membersOf(stored.include),
        exclude: membersOf(stored.exclude),
        excludeMyContacts: stored.excludeMyContacts,
        ...core,
      };
    case 'my-contacts':
      return { kind: 'my-contacts', exclude: membersOf(stored.exclude), ...core };
    case 'strangers':
      return { kind: 'strangers', ...core };
    default:
      return assertNever(stored);
  }
}

export type TDecodeFailure =
  | { readonly kind: 'not-json' }
  | { readonly kind: 'invalid'; readonly issues: string }
  | { readonly kind: 'no-migration' }
  | { readonly kind: 'migration-failed' }
  /** Written by a newer app: left as it is. */
  | { readonly kind: 'newer'; readonly version: number };

export interface IDecodedBook {
  readonly book: GroupBook;
  /** The version the text was written at when it was older than this app's: write it back. */
  readonly migratedFrom: number | null;
}

export function decodeGroupBook(text: string): TResult<IDecodedBook, TDecodeFailure> {
  const opened = openDocument(text, BOOK_HISTORY);
  switch (opened.kind) {
    case 'newer':
      return err({ kind: 'newer', version: opened.version });
    case 'unreadable':
      return err({ kind: opened.reason });
    case 'current':
    case 'migrated': {
      const parsed = bookData.safeParse(opened.data);
      if (!parsed.success) {
        return err({
          kind: 'invalid',
          issues: parsed.error.issues.map(issue => issue.path.join('.')).join(', '),
        });
      }
      return ok({
        book: groupBook(parsed.data.groups.map(groupOf)),
        migratedFrom: opened.kind === 'migrated' ? opened.from : null,
      });
    }
    default:
      return assertNever(opened);
  }
}

function encodeMember(item: TMember): TEncodedMember {
  const core = { id: item.id, updatedAt: item.updatedAt.toString(), excludedFor: item.excludedFor };
  switch (item.kind) {
    case 'number-mask':
      return { kind: 'number-mask', source: item.mask.source, note: item.note, ...core };
    case 'name-mask':
      return {
        kind: 'name-mask',
        source: item.mask.source,
        field: item.field,
        note: item.note,
        ...core,
      };
    case 'special':
      return { kind: 'special', special: item.special, ...core };
    case 'contact':
      return {
        kind: 'contact',
        displayName: item.displayName,
        numbers: [...item.numbers],
        lookupKey: item.lookupKey,
        ...core,
      };
    default:
      return assertNever(item);
  }
}

/** Temporal values become their ISO strings; everything else is already plain data. */
export function encodeGroupBook(book: GroupBook): string {
  return sealDocument(
    BOOK_HISTORY,
    {
      groups: book.groups.map(item => ({
        ...item,
        ...(item.kind === 'strangers' ? {} : { exclude: item.exclude.map(encodeMember) }),
        ...(item.kind === 'custom' ? { include: item.include.map(encodeMember) } : {}),
      })),
    },
    (_key, value: unknown) => (isTemporal(value) ? value.toString() : value)
  );
}

function isTemporal(value: unknown): value is { toString(): string } {
  return (
    value instanceof Temporal.Instant ||
    value instanceof Temporal.PlainDate ||
    value instanceof Temporal.PlainTime ||
    value instanceof Temporal.PlainDateTime
  );
}
