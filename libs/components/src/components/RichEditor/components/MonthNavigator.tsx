import { memo } from 'react';
import type { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../../hooks/useFunction';
import type { ICalendarAriaLabels } from '../defs';
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

    const handlePreviousYear = useFunction(() =>
      onYearMonthChange(yearMonth.subtract({ years: 1 }))
    );
    const handlePreviousMonth = useFunction(() =>
      onYearMonthChange(yearMonth.subtract({ months: 1 }))
    );
    const handleNextMonth = useFunction(() => onYearMonthChange(yearMonth.add({ months: 1 })));
    const handleNextYear = useFunction(() => onYearMonthChange(yearMonth.add({ years: 1 })));

    return (
      <fieldset className={styles.monthNavigator} aria-label={ariaLabels.monthNavigation}>
        <div>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handlePreviousYear}
            aria-label={ariaLabels.previousYear}
          >
            {'<<'}
          </button>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handlePreviousMonth}
            aria-label={ariaLabels.previousMonth}
          >
            {'<'}
          </button>
        </div>
        <span className={styles.monthNavigatorLabel} aria-live="polite" aria-atomic="true">
          {label}
        </span>
        <div>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handleNextMonth}
            aria-label={ariaLabels.nextMonth}
          >
            {'>'}
          </button>
          <button
            type="button"
            className={styles.monthNavigatorBtn}
            onClick={handleNextYear}
            aria-label={ariaLabels.nextYear}
          >
            {'>>'}
          </button>
        </div>
      </fieldset>
    );
  }
);
