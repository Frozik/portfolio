import { getEndOfMonth, getStartOfMonth, getStartOfWeek } from '@frozik/utils/date/boundaries';
import type { EDayType } from '@frozik/utils/date/constants';
import { DAYS_IN_WEEK, EDayType as DayType, EDayOfWeek } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import type { KeyboardEvent } from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../../hooks/useFunction';
import { clampDate, moveActiveDate } from '../calendar-keys';
import type { TLeaveDirection } from '../defs';
import { DayCell } from './DayCell';
import { defaultStartOfWeek } from './week-info';
import styles from '../styles.module.css';

interface IGridDay {
  readonly date: Temporal.PlainDate;
  readonly weekend: boolean;
  readonly overflow: boolean;
}

function defaultGetDayInfo(date: Temporal.PlainDate): EDayType {
  return date.dayOfWeek === EDayOfWeek.Saturday || date.dayOfWeek === EDayOfWeek.Sunday
    ? DayType.Weekend
    : DayType.Business;
}

function isSameDate(left: Temporal.PlainDate, right: Temporal.PlainDate | undefined): boolean {
  return !isNil(right) && Temporal.PlainDate.compare(left, right) === 0;
}

export const DateSelector = memo(
  ({
    yearMonth,
    today,
    getDayInfo = defaultGetDayInfo,
    startOfWeek,
    selectedDate,
    activeDate,
    focusRequest,
    minDate,
    maxDate,
    onSelectCalendarDate,
    onActiveDateChange,
    onLeave,
    onReturnToField,
    locale,
    label,
  }: {
    readonly yearMonth: Temporal.PlainYearMonth;
    readonly today: Temporal.PlainDate;
    readonly getDayInfo?: (date: Temporal.PlainDate) => EDayType;
    readonly startOfWeek?: EDayOfWeek;
    readonly selectedDate?: Temporal.PlainDate;
    /** The cell the keyboard lands on; always inside the shown month and range. */
    readonly activeDate: Temporal.PlainDate;
    /** Bumped by the owner to move the keyboard into the grid. */
    readonly focusRequest: number;
    readonly minDate?: Temporal.PlainDate;
    readonly maxDate?: Temporal.PlainDate;
    readonly onSelectCalendarDate: (date: Temporal.PlainDate) => void;
    readonly onActiveDateChange: (date: Temporal.PlainDate) => void;
    readonly onLeave: (direction: TLeaveDirection) => void;
    readonly onReturnToField: () => void;
    readonly locale: string;
    readonly label: string;
  }) => {
    const firstDayOfWeek = startOfWeek ?? defaultStartOfWeek(locale);
    const activeCellRef = useRef<HTMLButtonElement>(null);
    const followActiveCellRef = useRef(false);

    const firstVisibleDate = useMemo(
      () => getStartOfWeek(getStartOfMonth(yearMonth), firstDayOfWeek),
      [yearMonth, firstDayOfWeek]
    );

    // Day types and range bounds change rarely; selection and today are cheap per-cell checks.
    const days = useMemo((): readonly IGridDay[] => {
      const endOfMonth = getEndOfMonth(yearMonth);
      const grid: IGridDay[] = [];

      for (
        let date = firstVisibleDate;
        Temporal.PlainDate.compare(date, endOfMonth) <= 0;
        date = date.add({ days: 1 })
      ) {
        const dayType = getDayInfo(date);
        grid.push({
          date,
          weekend: dayType === DayType.Weekend || dayType === DayType.Holiday,
          overflow:
            Temporal.PlainYearMonth.compare(date, yearMonth) !== 0 ||
            (!isNil(minDate) && Temporal.PlainDate.compare(date, minDate) < 0) ||
            (!isNil(maxDate) && Temporal.PlainDate.compare(date, maxDate) > 0),
        });
      }

      return grid;
    }, [yearMonth, firstVisibleDate, getDayInfo, minDate, maxDate]);

    const weekdays = useMemo(
      () =>
        Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
          const date = firstVisibleDate.add({ days: index });
          return {
            key: date.dayOfWeek,
            short: date.toLocaleString(locale, { weekday: 'short' }),
            long: date.toLocaleString(locale, { weekday: 'long' }),
          };
        }),
      [firstVisibleDate, locale]
    );

    useEffect(() => {
      if (focusRequest > 0) {
        activeCellRef.current?.focus();
      }
    }, [focusRequest]);

    // A key moved the active cell; the keyboard follows it once it is rendered.
    useEffect(() => {
      if (followActiveCellRef.current) {
        followActiveCellRef.current = false;
        activeCellRef.current?.focus();
      }
    });

    const handleKeyDown = useFunction((event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        onLeave(event.shiftKey ? 'backward' : 'forward');
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onReturnToField();
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectCalendarDate(activeDate);
        onReturnToField();
        return;
      }

      const moved = moveActiveDate(activeDate, event.key, event.shiftKey, firstDayOfWeek);
      if (isNil(moved)) {
        return;
      }
      event.preventDefault();
      const next = clampDate(moved, minDate, maxDate);
      if (!isSameDate(next, activeDate)) {
        followActiveCellRef.current = true;
        onActiveDateChange(next);
      }
    });

    return (
      <div
        role="group"
        aria-label={label}
        className={styles.calendarGrid}
        onKeyDown={handleKeyDown}
      >
        {weekdays.map(weekday => (
          <abbr key={weekday.key} className={styles.weekday} title={weekday.long}>
            {weekday.short}
          </abbr>
        ))}
        {days.map(day => {
          const active = isSameDate(day.date, activeDate);
          return (
            <DayCell
              key={day.date.toString()}
              ref={active ? activeCellRef : undefined}
              date={day.date}
              weekend={day.weekend}
              overflow={day.overflow}
              today={isSameDate(day.date, today)}
              selected={isSameDate(day.date, selectedDate)}
              active={active}
              onSelect={onSelectCalendarDate}
              locale={locale}
            />
          );
        })}
      </div>
    );
  }
);
