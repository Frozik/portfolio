import type { ISO, TenorDate, ValueDescriptor } from '@frozik/utils';
import {
  createSyncedValueDescriptor,
  DAYS_IN_WEEK,
  EDayOfWeek,
  EMPTY_VD,
  getEndOfMonth,
  getStartOfMonth,
  getStartOfWeek,
  matchValueDescriptor,
} from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { cn } from '../../cn';

import { DayCell } from './DayCell';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DateSelector = memo(
  ({
    yearMonth,
    today = EMPTY_VD,
    tenors = EMPTY_VD,
    weekendDays = EMPTY_VD,
    startOfWeek = EDayOfWeek.Monday,
    selectedDate,
    minDate,
    maxDate,
    calendarClassName,
    calendarDayCellClassName,
    calendarDayCellTodayClassName,
    calendarDayCellSelectedClassName,
    calendarDayCellWeekendClassName,
    calendarDayCellTenorClassName,
    calendarDayCellOverflowClassName,
    onSelectCalendarDate,
    calendarHeaderClassName,
  }: {
    yearMonth: Temporal.PlainYearMonth;
    selectedDate?: Temporal.PlainDate;
    today?: ValueDescriptor<Temporal.PlainDate>;
    tenors?: ValueDescriptor<TenorDate[]>;
    weekendDays?: ValueDescriptor<Temporal.PlainDate[]>;
    startOfWeek?: EDayOfWeek;
    minDate?: Temporal.PlainDate;
    maxDate?: Temporal.PlainDate;
    calendarClassName: string;
    calendarDayCellClassName: string;
    calendarDayCellTodayClassName: string;
    calendarDayCellSelectedClassName: string;
    calendarDayCellWeekendClassName: string;
    calendarDayCellTenorClassName: string;
    calendarDayCellOverflowClassName: string;
    calendarHeaderClassName: string;
    onSelectCalendarDate?: (date: Temporal.PlainDate) => void;
  }) => {
    const tenorsMap = useMemo<ValueDescriptor<ReadonlyMap<ISO, TenorDate[]>>>(
      () =>
        matchValueDescriptor(tenors, ({ value }) =>
          createSyncedValueDescriptor(
            value.reduce((acc, tenorDate) => {
              const isoDate = tenorDate.date.toString() as ISO;

              const tenors = acc.get(isoDate);

              if (isNil(tenors)) {
                acc.set(isoDate, [tenorDate]);
              } else {
                tenors.push(tenorDate);
              }

              return acc;
            }, new Map<ISO, TenorDate[]>())
          )
        ),
      [tenors]
    );
    const weekendsSet: ValueDescriptor<ReadonlySet<ISO>> = useMemo(
      () =>
        matchValueDescriptor(weekendDays, ({ value }) =>
          createSyncedValueDescriptor(new Set(value.map(value => value.toString() as ISO)))
        ),
      [weekendDays]
    );

    const dateGrid = useMemo(() => {
      const startOfMonth = getStartOfMonth(yearMonth);
      const endOfMonth = getEndOfMonth(yearMonth);
      const startOfViewPort = getStartOfWeek(startOfMonth, startOfWeek);

      const dateGrid: {
        date: Temporal.PlainDate;
        tenors: TenorDate[];
        weekend: boolean;
        today: boolean;
        selected: boolean;
        overflow: boolean;
      }[][] = [];

      let currentDate = startOfViewPort;

      while (Temporal.PlainDate.compare(currentDate, endOfMonth) <= 0) {
        const dateGridRow: Temporal.PlainDate[] = [];

        for (let index = 0; index < DAYS_IN_WEEK; index++) {
          dateGridRow.push(currentDate.add({ days: index }));
        }

        currentDate = currentDate.add({ days: DAYS_IN_WEEK });

        dateGrid.push(
          dateGridRow.map(date => {
            const dateISO = date.toString() as ISO;

            return {
              date,
              tenors: tenorsMap.value?.get(dateISO) ?? [],
              weekend: weekendsSet.value?.has(dateISO) ?? false,
              today: matchValueDescriptor(today, {
                synced: ({ value }) => Temporal.PlainDate.compare(date, value) === 0,
                unsynced: () => false,
              }),
              selected:
                !isNil(selectedDate) && Temporal.PlainDate.compare(date, selectedDate) === 0,
              overflow:
                Temporal.PlainYearMonth.compare(date, yearMonth) !== 0 ||
                (!isNil(minDate) && Temporal.PlainDate.compare(date, minDate) < 0) ||
                (!isNil(maxDate) && Temporal.PlainDate.compare(date, maxDate) > 0),
            };
          })
        );
      }

      return dateGrid;
    }, [
      yearMonth,
      startOfWeek,
      tenorsMap.value,
      weekendsSet.value,
      today,
      selectedDate,
      minDate,
      maxDate,
    ]);

    const header = useMemo(() => {
      const header: ReactNode[] = [];

      for (let index = 0; index < DAYS_IN_WEEK; index++) {
        header.push(
          <div key={index} className={cn(calendarDayCellClassName, calendarHeaderClassName)}>
            {DAY_NAMES[(startOfWeek - 1 + index) % DAYS_IN_WEEK].substring(0, 2)}
          </div>
        );
      }

      return header;
    }, [calendarDayCellClassName, calendarHeaderClassName, startOfWeek]);

    return (
      <div className={calendarClassName}>
        {header}
        {dateGrid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <DayCell
              key={cell.date.toString()}
              cell={cell}
              gridColumn={colIndex + 1}
              gridRow={rowIndex + 2}
              calendarDayCellClassName={calendarDayCellClassName}
              calendarDayCellTodayClassName={calendarDayCellTodayClassName}
              calendarDayCellSelectedClassName={calendarDayCellSelectedClassName}
              calendarDayCellWeekendClassName={calendarDayCellWeekendClassName}
              calendarDayCellTenorClassName={calendarDayCellTenorClassName}
              calendarDayCellOverflowClassName={calendarDayCellOverflowClassName}
              onSelectCalendarDate={onSelectCalendarDate}
            />
          ))
        )}
      </div>
    );
  }
);
