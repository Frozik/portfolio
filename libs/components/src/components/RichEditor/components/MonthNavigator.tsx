import type { Temporal } from '@js-temporal/polyfill';
import { memo, useMemo } from 'react';

import { useFunction } from '../../../hooks';
import { getCalendarAriaLabels } from '../translations';

export const MonthNavigator = memo(
  ({
    yearMonth,
    onYearMonthChange,
    className,
    buttonClassName,
    labelClassName,
    language,
  }: {
    yearMonth: Temporal.PlainYearMonth;
    onYearMonthChange: (yearMonth: Temporal.PlainYearMonth) => void;
    className: string;
    buttonClassName: string;
    labelClassName: string;
    language: string;
  }) => {
    const ariaLabels = useMemo(() => getCalendarAriaLabels(language), [language]);

    const label = useMemo(
      () => `${ariaLabels.monthNames[yearMonth.month - 1]} ${yearMonth.year}`,
      [yearMonth, ariaLabels.monthNames]
    );

    const handlePrevMonth = useFunction(() => {
      onYearMonthChange(yearMonth.subtract({ months: 1 }));
    });

    const handleNextMonth = useFunction(() => {
      onYearMonthChange(yearMonth.add({ months: 1 }));
    });

    const handlePrevYear = useFunction(() => {
      onYearMonthChange(yearMonth.subtract({ years: 1 }));
    });

    const handleNextYear = useFunction(() => {
      onYearMonthChange(yearMonth.add({ years: 1 }));
    });

    return (
      <fieldset className={className} aria-label={ariaLabels.monthNavigation}>
        <div>
          <button
            type="button"
            className={buttonClassName}
            onClick={handlePrevYear}
            aria-label={ariaLabels.previousYear}
          >
            {'<<'}
          </button>
          <button
            type="button"
            className={buttonClassName}
            onClick={handlePrevMonth}
            aria-label={ariaLabels.previousMonth}
          >
            {'<'}
          </button>
        </div>
        <span className={labelClassName} aria-live="polite" aria-atomic="true">
          {label}
        </span>
        <div>
          <button
            type="button"
            className={buttonClassName}
            onClick={handleNextMonth}
            aria-label={ariaLabels.nextMonth}
          >
            {'>'}
          </button>
          <button
            type="button"
            className={buttonClassName}
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
