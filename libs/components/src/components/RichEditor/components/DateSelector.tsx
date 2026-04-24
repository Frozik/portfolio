import { getEndOfMonth, getStartOfMonth, getStartOfWeek } from '@frozik/utils/date/boundaries';
import type { EDayType } from '@frozik/utils/date/constants';
import { EDayType as DayType, EDayOfWeek } from '@frozik/utils/date/constants';
import { DAYS_IN_WEEK } from '@frozik/utils/date/fuzzy/constants';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import { EMPTY_VD, matchValueDescriptor } from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import { Temporal } from 'temporal-polyfill';
import { cn } from '../../cn';

import { getCalendarAriaLabels } from '../translations/translations';
import { DayCell } from './DayCell';

function defaultGetDayInfo(date: Temporal.PlainDate): EDayType {
  if (date.dayOfWeek === EDayOfWeek.Saturday || date.dayOfWeek === EDayOfWeek.Sunday) {
    return DayType.Weekend;
  }
  return DayType.Business;
}

export const DateSelector = memo(
  ({
    yearMonth,
    today = EMPTY_VD,
    getDayInfo = defaultGetDayInfo,
    startOfWeek = EDayOfWeek.Monday,
    selectedDate,
    minDate,
    maxDate,
    onSelectCalendarDate,
    language,
  }: {
    yearMonth: Temporal.PlainYearMonth;
    selectedDate?: Temporal.PlainDate;
    today?: ValueDescriptor<Temporal.PlainDate>;
    getDayInfo?: (date: Temporal.PlainDate) => EDayType;
    startOfWeek?: EDayOfWeek;
    minDate?: Temporal.PlainDate;
    maxDate?: Temporal.PlainDate;
    onSelectCalendarDate?: (date: Temporal.PlainDate) => void;
    language: string;
  }) => {
    const ariaLabels = useMemo(() => getCalendarAriaLabels(language), [language]);

    const dateGrid = useMemo(() => {
      const startOfMonth = getStartOfMonth(yearMonth);
      const endOfMonth = getEndOfMonth(yearMonth);
      const startOfViewPort = getStartOfWeek(startOfMonth, startOfWeek);

      const dateGrid: {
        date: Temporal.PlainDate;
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
            const dayType = getDayInfo(date);

            return {
              date,
              weekend: dayType === DayType.Weekend || dayType === DayType.Holiday,
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
    }, [yearMonth, startOfWeek, getDayInfo, today, selectedDate, minDate, maxDate]);

    const header = useMemo(() => {
      const header: ReactNode[] = [];

      for (let index = 0; index < DAYS_IN_WEEK; index++) {
        const dayIndex = (startOfWeek - 1 + index) % DAYS_IN_WEEK;
        header.push(
          <abbr
            key={index}
            className={cn(
              'flex size-7 items-center justify-center font-mono text-[10px] font-semibold tracking-[0.08em] text-landing-fg-faint uppercase',
              'pointer-events-none no-underline'
            )}
            title={ariaLabels.dayNames[dayIndex]}
          >
            {ariaLabels.dayNamesShort[dayIndex]}
          </abbr>
        );
      }

      return header;
    }, [startOfWeek, ariaLabels]);

    return (
      <div className="grid grid-cols-7 gap-1 p-1 justify-items-center">
        {header}
        {dateGrid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <DayCell
              key={cell.date.toString()}
              cell={cell}
              gridColumn={colIndex + 1}
              gridRow={rowIndex + 2}
              onSelectCalendarDate={onSelectCalendarDate}
              monthNames={ariaLabels.monthNames}
            />
          ))
        )}
      </div>
    );
  }
);
