import { memo } from 'react';
import type { Temporal } from 'temporal-polyfill';

import { useEventCallback } from 'usehooks-ts';
import type { ICalendarAriaLabels } from '../defs';
import { ChevronIcon, DoubleChevronIcon } from './icons';
import styles from '../styles.module.css';

export const MonthNavigator = memo(
  ({
    yearMonth,
    onYearMonthChange,
    locale,
    ariaLabels,
  }: {
    readonly yearMonth: Temporal.PlainYearMonth;
    readonly onYearMonthChange: (yearMonth: Temporal.PlainYearMonth) => void;
    readonly locale: string;
    readonly ariaLabels: ICalendarAriaLabels;
  }) => {
    // Year-month formatting insists on a matching calendar; a date does not.
    const label = yearMonth
      .toPlainDate({ day: 1 })
      .toLocaleString(locale, { month: 'long', year: 'numeric' });

    const handlePreviousYear = useEventCallback(() =>
      onYearMonthChange(yearMonth.subtract({ years: 1 }))
    );
    const handlePreviousMonth = useEventCallback(() =>
      onYearMonthChange(yearMonth.subtract({ months: 1 }))
    );
    const handleNextMonth = useEventCallback(() => onYearMonthChange(yearMonth.add({ months: 1 })));
    const handleNextYear = useEventCallback(() => onYearMonthChange(yearMonth.add({ years: 1 })));

    return (
      <fieldset className={styles.monthNavigator} aria-label={ariaLabels.monthNavigation}>
        <div className={styles.monthNavigatorGroup}>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handlePreviousYear}
            aria-label={ariaLabels.previousYear}
          >
            <DoubleChevronIcon direction="left" />
          </button>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handlePreviousMonth}
            aria-label={ariaLabels.previousMonth}
          >
            <ChevronIcon direction="left" />
          </button>
        </div>
        <span className={styles.monthNavigatorLabel} aria-live="polite" aria-atomic="true">
          {label}
        </span>
        <div className={styles.monthNavigatorGroup}>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handleNextMonth}
            aria-label={ariaLabels.nextMonth}
          >
            <ChevronIcon direction="right" />
          </button>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handleNextYear}
            aria-label={ariaLabels.nextYear}
          >
            <DoubleChevronIcon direction="right" />
          </button>
        </div>
      </fieldset>
    );
  }
);
