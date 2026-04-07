import type { DayInfo, ETimeResolution, TenorDate, ValueDescriptor } from '@frozik/utils';
import {
  createSyncedValueDescriptor,
  EDayType,
  getEndOfMonth,
  getStartOfMonth,
  getStartOfWeek,
} from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';
import type { MouseEvent } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useFunction } from '../../../hooks';
import styles from '../styles.module.scss';
import { DateSelector } from './DateSelector';
import { MonthNavigator } from './MonthNavigator';
import { TimePicker } from './TimePicker';

const DAYS_IN_WEEK = 7;

export const CalendarPopup = memo(
  ({
    value,
    time,
    today,
    getDayInfo,
    timeResolution,
    minDate,
    maxDate,
    onSelectDate,
    onTimeChange,
  }: {
    value?: Temporal.PlainDate;
    time: Temporal.PlainTime;
    today: Temporal.PlainDate;
    getDayInfo: (date: Temporal.PlainDate) => DayInfo;
    timeResolution?: ETimeResolution;
    minDate?: Temporal.PlainDate;
    maxDate?: Temporal.PlainDate;
    onSelectDate: (date: Temporal.PlainDate) => void;
    onTimeChange: (time: Temporal.PlainTime) => void;
  }) => {
    const [yearMonth, setYearMonth] = useState(() =>
      Temporal.PlainYearMonth.from({
        year: (value ?? today).year,
        month: (value ?? today).month,
      })
    );

    // When user manually navigates with < > buttons, we don't want to override.
    // But when the value changes (arrow key step), always follow the value.
    const userNavigatedRef = useRef(false);

    const handleYearMonthChange = useFunction((ym: Temporal.PlainYearMonth) => {
      userNavigatedRef.current = true;
      setYearMonth(ym);
    });

    // Sync calendar view when value changes (arrow key stepping or calendar date click)
    useEffect(() => {
      if (isNil(value)) {
        return;
      }

      // Value changed — reset manual navigation flag and follow value
      userNavigatedRef.current = false;

      const valueYM = Temporal.PlainYearMonth.from({ year: value.year, month: value.month });
      setYearMonth(prev => (Temporal.PlainYearMonth.compare(valueYM, prev) !== 0 ? valueYM : prev));
    }, [value]);

    // Compute weekend and tenor arrays from getDayInfo for the visible month range
    const { weekendDays, tenors } = useMemo(() => {
      const startOfMonth = getStartOfMonth(yearMonth);
      const endOfMonth = getEndOfMonth(yearMonth);
      const startOfView = getStartOfWeek(startOfMonth);

      const weekends: Temporal.PlainDate[] = [];
      const tenorDates: TenorDate[] = [];

      let current = startOfView;
      // Iterate through all visible dates (up to 6 weeks)
      const maxRows = 6;
      const maxDays = maxRows * DAYS_IN_WEEK;

      for (let i = 0; i < maxDays; i++) {
        if (Temporal.PlainDate.compare(current, endOfMonth) > 0 && i >= DAYS_IN_WEEK) {
          // Past end of month and at least one full week rendered
          if (i % DAYS_IN_WEEK === 0) {
            break;
          }
        }

        const info = getDayInfo(current);

        if (info.type === EDayType.Weekend || info.type === EDayType.Holiday) {
          weekends.push(current);
        }

        if (!isNil(info.tenor)) {
          tenorDates.push({ tenor: info.tenor, date: current });
        }

        current = current.add({ days: 1 });
      }

      return {
        weekendDays: createSyncedValueDescriptor(weekends) as ValueDescriptor<Temporal.PlainDate[]>,
        tenors: createSyncedValueDescriptor(tenorDates) as ValueDescriptor<TenorDate[]>,
      };
    }, [yearMonth, getDayInfo]);

    const todayVD = useMemo(
      () => createSyncedValueDescriptor(today) as ValueDescriptor<Temporal.PlainDate>,
      [today]
    );

    // Prevent mousedown from stealing focus from the input
    const handleMouseDown = useFunction((event: MouseEvent) => {
      event.preventDefault();
    });

    return (
      <div className={styles.popoverContent} onMouseDown={handleMouseDown}>
        <MonthNavigator
          yearMonth={yearMonth}
          onYearMonthChange={handleYearMonthChange}
          className={styles.monthNavigator}
          buttonClassName={styles.monthNavigatorBtn}
          labelClassName={styles.monthNavigatorLabel}
        />
        <DateSelector
          yearMonth={yearMonth}
          today={todayVD}
          tenors={tenors}
          weekendDays={weekendDays}
          selectedDate={value}
          minDate={minDate}
          maxDate={maxDate}
          calendarClassName={styles.calendar}
          calendarDayCellClassName={styles.calendarDayCell}
          calendarDayCellTodayClassName={styles.calendarDayCellToday}
          calendarDayCellSelectedClassName={styles.calendarDayCellSelected}
          calendarDayCellWeekendClassName={styles.calendarDayCellWeekend}
          calendarDayCellTenorClassName={styles.calendarDayCellTenor}
          calendarDayCellOverflowClassName={styles.calendarDayCellOverflow}
          calendarHeaderClassName={styles.calendarDayCellHeader}
          onSelectCalendarDate={onSelectDate}
        />
        <TimePicker time={time} resolution={timeResolution} onTimeChange={onTimeChange} />
      </div>
    );
  }
);
