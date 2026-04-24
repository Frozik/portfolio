import type { EDayOfWeek, EDayType, ETimeResolution } from '@frozik/utils/date/constants';
import type { ValueDescriptor } from '@frozik/utils/value-descriptors/types';
import { createSyncedValueDescriptor, EMPTY_VD } from '@frozik/utils/value-descriptors/utils';
import { isNil } from 'lodash-es';
import type { MouseEvent } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../../hooks/useFunction';
import styles from '../styles.module.scss';
import { getCalendarAriaLabels } from '../translations/translations';
import { DateSelector } from './DateSelector';
import { MonthNavigator } from './MonthNavigator';
import { TimePicker } from './TimePicker';

export const CalendarPopup = memo(
  ({
    value,
    time,
    today,
    getDayInfo,
    startOfWeek,
    timeResolution,
    minDate,
    maxDate,
    onSelectDate,
    onTimeChange,
    language,
  }: {
    value?: Temporal.PlainDate;
    time: Temporal.PlainTime;
    today?: Temporal.PlainDate;
    getDayInfo?: (date: Temporal.PlainDate) => EDayType;
    startOfWeek?: EDayOfWeek;
    timeResolution?: ETimeResolution;
    minDate?: Temporal.PlainDate;
    maxDate?: Temporal.PlainDate;
    onSelectDate: (date: Temporal.PlainDate) => void;
    onTimeChange: (time: Temporal.PlainTime) => void;
    language: string;
  }) => {
    const ariaLabels = useMemo(() => getCalendarAriaLabels(language), [language]);

    const [yearMonth, setYearMonth] = useState(() => {
      const referenceDate = value ?? today;
      if (isNil(referenceDate)) {
        return Temporal.Now.plainDateISO().toPlainYearMonth();
      }
      return Temporal.PlainYearMonth.from({
        year: referenceDate.year,
        month: referenceDate.month,
      });
    });

    const userNavigatedRef = useRef(false);

    const handleYearMonthChange = useFunction((ym: Temporal.PlainYearMonth) => {
      userNavigatedRef.current = true;
      setYearMonth(ym);
    });

    useEffect(() => {
      if (isNil(value)) {
        return;
      }

      userNavigatedRef.current = false;

      const valueYM = Temporal.PlainYearMonth.from({ year: value.year, month: value.month });
      setYearMonth(prev => (Temporal.PlainYearMonth.compare(valueYM, prev) !== 0 ? valueYM : prev));
    }, [value]);

    const todayVD = useMemo(
      () =>
        isNil(today)
          ? (EMPTY_VD as ValueDescriptor<Temporal.PlainDate>)
          : (createSyncedValueDescriptor(today) as ValueDescriptor<Temporal.PlainDate>),
      [today]
    );

    const handleMouseDown = useFunction((event: MouseEvent) => {
      event.preventDefault();
    });

    return (
      <section
        className={styles.popoverContent}
        onMouseDown={handleMouseDown}
        aria-label={ariaLabels.datePicker}
      >
        <MonthNavigator
          yearMonth={yearMonth}
          onYearMonthChange={handleYearMonthChange}
          className={styles.monthNavigator}
          buttonClassName={styles.monthNavigatorBtn}
          labelClassName={styles.monthNavigatorLabel}
          language={language}
        />
        <DateSelector
          yearMonth={yearMonth}
          today={todayVD}
          getDayInfo={getDayInfo}
          startOfWeek={startOfWeek}
          selectedDate={value}
          minDate={minDate}
          maxDate={maxDate}
          onSelectCalendarDate={onSelectDate}
          language={language}
        />
        <TimePicker
          time={time}
          resolution={timeResolution}
          onTimeChange={onTimeChange}
          language={language}
        />
      </section>
    );
  }
);
