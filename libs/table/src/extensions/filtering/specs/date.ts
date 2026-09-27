import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { getStartOfWeek } from '@frozik/utils/date/boundaries';

import type { IDateCondition, IDateFilterModel, TDateOp } from '../model';
import { isEmptyFilterModel, joinConditions, OPS_ACCEPTING_EMPTY } from '../model';
import type { IConditionFilterOptions, IFilterOperator, IFilterSpec, TPredicate } from '../spec';
import { resolveOperators } from '../spec';

export interface IDateFilterOptions extends IConditionFilterOptions<unknown, IDateCondition> {
  /** Calendar days for `today`, `thisWeek` … and for date-only bounds; the browser zone otherwise. */
  readonly timeZone?: string;
  readonly inclusive?: boolean;
  readonly now?: () => Temporal.Instant;
}

export type TDateFilterSpec = IFilterSpec<unknown, IDateFilterModel, IDateFilterOptions> & {
  readonly operators: readonly IFilterOperator<unknown, IDateCondition>[];
};

export const DATE_OPS: readonly TDateOp[] = [
  'equals',
  'notEquals',
  'greaterThan',
  'greaterOrEqual',
  'lessThan',
  'lessOrEqual',
  'between',
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'last7Days',
  'last30Days',
  'blank',
  'notBlank',
];

const DAYS_IN_LAST_7 = 7;
const DAYS_IN_LAST_30 = 30;

interface IWindow {
  readonly start: Temporal.Instant;
  /** Exclusive. */
  readonly end: Temporal.Instant;
}

/** Cell values may be ISO strings, instants, zoned or plain dates; comparison happens on the instant. */
export function toInstant(value: unknown, timeZone: string): Temporal.Instant | undefined {
  if (typeof value === 'string') {
    if (value === '') {
      return undefined;
    }
    return value.includes('T')
      ? Temporal.Instant.from(value)
      : Temporal.PlainDate.from(value).toZonedDateTime(timeZone).toInstant();
  }
  if (value instanceof Temporal.Instant) {
    return value;
  }
  if (value instanceof Temporal.ZonedDateTime) {
    return value.toInstant();
  }
  if (value instanceof Temporal.PlainDateTime) {
    return value.toZonedDateTime(timeZone).toInstant();
  }
  if (value instanceof Temporal.PlainDate) {
    return value.toZonedDateTime(timeZone).toInstant();
  }
  return undefined;
}

function dayWindow(
  from: Temporal.PlainDate,
  toExclusive: Temporal.PlainDate,
  timeZone: string
): IWindow {
  return {
    start: from.toZonedDateTime(timeZone).toInstant(),
    end: toExclusive.toZonedDateTime(timeZone).toInstant(),
  };
}

function relativeWindow(op: string, now: Temporal.Instant, timeZone: string): IWindow | undefined {
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate();
  const tomorrow = today.add({ days: 1 });
  const week = getStartOfWeek(today);
  const month = today.with({ day: 1 });
  switch (op) {
    case 'today':
      return dayWindow(today, tomorrow, timeZone);
    case 'yesterday':
      return dayWindow(today.subtract({ days: 1 }), today, timeZone);
    case 'thisWeek':
      return dayWindow(week, week.add({ weeks: 1 }), timeZone);
    case 'lastWeek':
      return dayWindow(week.subtract({ weeks: 1 }), week, timeZone);
    case 'thisMonth':
      return dayWindow(month, month.add({ months: 1 }), timeZone);
    case 'lastMonth':
      return dayWindow(month.subtract({ months: 1 }), month, timeZone);
    case 'thisYear':
      return dayWindow(
        today.with({ month: 1, day: 1 }),
        today.with({ month: 1, day: 1 }).add({ years: 1 }),
        timeZone
      );
    case 'last7Days':
      return dayWindow(today.subtract({ days: DAYS_IN_LAST_7 - 1 }), tomorrow, timeZone);
    case 'last30Days':
      return dayWindow(today.subtract({ days: DAYS_IN_LAST_30 - 1 }), tomorrow, timeZone);
    default:
      return undefined;
  }
}

/** A date-only bound covers its whole calendar day: `equals 2026-09-27` matches any instant of that day. */
const ZONED_INSTANT = /Z$|[+-]\d{2}:\d{2}$/;

/**
 * A bound covers the whole span it names: a date its calendar day, a zone-less
 * date-time (what a `datetime-local` input yields) its minute or second in the
 * column time zone, an instant exactly itself.
 */
function boundWindow(bound: string, timeZone: string): IWindow {
  if (!bound.includes('T')) {
    const day = Temporal.PlainDate.from(bound);
    return dayWindow(day, day.add({ days: 1 }), timeZone);
  }
  if (ZONED_INSTANT.test(bound)) {
    const instant = Temporal.Instant.from(bound);
    return { start: instant, end: instant.add({ nanoseconds: 1 }) };
  }
  const local = Temporal.PlainDateTime.from(bound);
  const unit = bound.split('T')[1].split(':').length > 2 ? 'seconds' : 'minutes';
  return {
    start: local.toZonedDateTime(timeZone).toInstant(),
    end: local
      .add({ [unit]: 1 })
      .toZonedDateTime(timeZone)
      .toInstant(),
  };
}

function inWindow(value: Temporal.Instant, window: IWindow): boolean {
  return (
    Temporal.Instant.compare(value, window.start) >= 0 &&
    Temporal.Instant.compare(value, window.end) < 0
  );
}

function builtInTest(
  condition: IDateCondition,
  options: IDateFilterOptions,
  timeZone: string
): ((value: Temporal.Instant | undefined) => boolean) | undefined {
  const relative = relativeWindow(
    condition.op,
    options.now?.() ?? Temporal.Now.instant(),
    timeZone
  );
  if (relative !== undefined) {
    return value => value !== undefined && inWindow(value, relative);
  }
  const from = isNil(condition.from) ? undefined : boundWindow(condition.from, timeZone);
  const to = isNil(condition.to) ? undefined : boundWindow(condition.to, timeZone);
  const inclusive = options.inclusive !== false;
  const after = (value: Temporal.Instant, window: IWindow): number =>
    Temporal.Instant.compare(value, window.end) >= 0 ? 1 : inWindow(value, window) ? 0 : -1;
  switch (condition.op) {
    case 'equals':
      return value => value !== undefined && from !== undefined && inWindow(value, from);
    case 'notEquals':
      return value => value === undefined || from === undefined || !inWindow(value, from);
    case 'greaterThan':
      return value => value !== undefined && from !== undefined && after(value, from) > 0;
    case 'greaterOrEqual':
      return value => value !== undefined && from !== undefined && after(value, from) >= 0;
    case 'lessThan':
      return value => value !== undefined && from !== undefined && after(value, from) < 0;
    case 'lessOrEqual':
      return value => value !== undefined && from !== undefined && after(value, from) <= 0;
    case 'between':
      return value => {
        if (value === undefined || from === undefined || to === undefined) {
          return false;
        }
        const low = after(value, from);
        const high = after(value, to);
        return inclusive ? low >= 0 && high <= 0 : low > 0 && high < 0;
      };
    case 'blank':
      return value => value === undefined;
    case 'notBlank':
      return value => value !== undefined;
    default:
      return undefined;
  }
}

export function dateFilter(options: IDateFilterOptions = {}): TDateFilterSpec {
  const operators = resolveOperators(DATE_OPS, options.operators);
  return {
    kind: 'date',
    options,
    operators,
    readOnly: options.readOnly,
    isEmpty: isEmptyFilterModel,
    predicate(model): TPredicate<unknown, unknown> {
      const timeZone = options.timeZone ?? Temporal.Now.timeZoneId();
      const tests = model.conditions.map(condition => {
        const custom = operators.find(operator => operator.id === condition.op)?.predicate;
        if (custom !== undefined) {
          return (value: unknown) => custom(condition, value);
        }
        const test = builtInTest(condition, options, timeZone);
        if (test === undefined) {
          return () => true;
        }
        return (value: unknown) =>
          isNil(value) && !OPS_ACCEPTING_EMPTY.has(condition.op)
            ? false
            : test(toInstant(value, timeZone));
      });
      return value =>
        joinConditions(model, condition => tests[model.conditions.indexOf(condition)](value));
    },
  };
}
