import type { EDayOfWeek, EDayType, ETimeResolution } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import type { FocusEvent, MouseEvent } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../../hooks/useFunction';
import { clampDate } from '../calendar-keys';
import type { ICalendarAriaLabels, TLeaveDirection } from '../defs';
import styles from '../styles.module.scss';
import { DateSelector } from './DateSelector';
import { MonthNavigator } from './MonthNavigator';
import { TimePicker } from './TimePicker';

function isSameYearMonth(left: Temporal.PlainYearMonth, right: Temporal.PlainYearMonth): boolean {
  return Temporal.PlainYearMonth.compare(left, right) === 0;
}

export const CalendarPopup = memo(
  ({
    value,
    time,
    today,
    getDayInfo,
    startOfWeek,
    showTime = true,
    timeResolution,
    minDate,
    maxDate,
    focusRequest,
    onSelectDate,
    onTimeChange,
    onFocusWithinChange,
    onLeave,
    onReturnToField,
    locale,
    ariaLabels,
  }: {
    readonly value?: Temporal.PlainDate;
    readonly time: Temporal.PlainTime;
    readonly today: Temporal.PlainDate;
    readonly getDayInfo?: (date: Temporal.PlainDate) => EDayType;
    readonly startOfWeek?: EDayOfWeek;
    readonly showTime?: boolean;
    readonly timeResolution?: ETimeResolution;
    readonly minDate?: Temporal.PlainDate;
    readonly maxDate?: Temporal.PlainDate;
    /** Bumped by the field to move the keyboard into the popup. */
    readonly focusRequest: number;
    readonly onSelectDate: (date: Temporal.PlainDate) => void;
    readonly onTimeChange: (time: Temporal.PlainTime) => void;
    readonly onFocusWithinChange: (focused: boolean) => void;
    /** The keyboard tabbed past the popup's first or last stop. */
    readonly onLeave: (direction: TLeaveDirection) => void;
    readonly onReturnToField: () => void;
    readonly locale: string;
    readonly ariaLabels: ICalendarAriaLabels;
  }) => {
    const [activeDate, setActiveDate] = useState(() => clampDate(value ?? today, minDate, maxDate));
    const [yearMonth, setYearMonth] = useState(() => activeDate.toPlainYearMonth());
    const [gridFocusRequest, setGridFocusRequest] = useState(0);
    const [timeFocusRequest, setTimeFocusRequest] = useState(0);
    // The request counter outlives the popup; only a bump after mount is a new request.
    const handledFocusRequestRef = useRef(focusRequest);

    useEffect(() => {
      if (isNil(value)) {
        return;
      }
      setActiveDate(value);
      setYearMonth(previous =>
        isSameYearMonth(value.toPlainYearMonth(), previous) ? previous : value.toPlainYearMonth()
      );
    }, [value]);

    const focusGrid = useFunction(() => {
      // Keep the keyboard inside the shown month; the browsed month wins over the value.
      if (!isSameYearMonth(activeDate.toPlainYearMonth(), yearMonth)) {
        setActiveDate(clampDate(yearMonth.toPlainDate({ day: 1 }), minDate, maxDate));
      }
      setGridFocusRequest(previous => previous + 1);
    });

    useEffect(() => {
      if (focusRequest !== handledFocusRequestRef.current) {
        handledFocusRequestRef.current = focusRequest;
        focusGrid();
      }
    }, [focusRequest, focusGrid]);

    const handleActiveDateChange = useFunction((date: Temporal.PlainDate) => {
      setActiveDate(date);
      setYearMonth(previous =>
        isSameYearMonth(date.toPlainYearMonth(), previous) ? previous : date.toPlainYearMonth()
      );
    });

    const handleGridLeave = useFunction((direction: TLeaveDirection) => {
      if (direction === 'forward' && showTime) {
        setTimeFocusRequest(previous => previous + 1);
      } else {
        onLeave(direction);
      }
    });

    const handleTimeLeave = useFunction((direction: TLeaveDirection) => {
      if (direction === 'backward') {
        focusGrid();
      } else {
        onLeave(direction);
      }
    });

    // The field keeps focus (and the popover stays open) while the popup is clicked.
    const handleMouseDown = useFunction((event: MouseEvent) => {
      event.preventDefault();
    });

    const handleFocus = useFunction(() => onFocusWithinChange(true));
    const handleBlur = useFunction((event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        onFocusWithinChange(false);
      }
    });

    return (
      <section
        className={styles.popoverContent}
        onMouseDown={handleMouseDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={ariaLabels.datePicker}
      >
        <MonthNavigator
          yearMonth={yearMonth}
          onYearMonthChange={setYearMonth}
          locale={locale}
          ariaLabels={ariaLabels}
        />
        <DateSelector
          yearMonth={yearMonth}
          today={today}
          getDayInfo={getDayInfo}
          startOfWeek={startOfWeek}
          selectedDate={value}
          activeDate={activeDate}
          focusRequest={gridFocusRequest}
          minDate={minDate}
          maxDate={maxDate}
          onSelectCalendarDate={onSelectDate}
          onActiveDateChange={handleActiveDateChange}
          onLeave={handleGridLeave}
          onReturnToField={onReturnToField}
          locale={locale}
          label={ariaLabels.calendarDays}
        />
        {showTime && (
          <TimePicker
            time={time}
            resolution={timeResolution}
            focusRequest={timeFocusRequest}
            onTimeChange={onTimeChange}
            onLeave={handleTimeLeave}
            onReturnToField={onReturnToField}
            ariaLabels={ariaLabels}
          />
        )}
      </section>
    );
  }
);
