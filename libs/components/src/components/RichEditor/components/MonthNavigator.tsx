import type { Temporal } from '@js-temporal/polyfill';
import { memo, useMemo } from 'react';

import { useFunction } from '../../../hooks';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MonthNavigator = memo(
  ({
    yearMonth,
    onYearMonthChange,
    className,
    buttonClassName,
    labelClassName,
  }: {
    yearMonth: Temporal.PlainYearMonth;
    onYearMonthChange: (yearMonth: Temporal.PlainYearMonth) => void;
    className: string;
    buttonClassName: string;
    labelClassName: string;
  }) => {
    const label = useMemo(
      () => `${MONTH_NAMES[yearMonth.month - 1]} ${yearMonth.year}`,
      [yearMonth]
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
      <div className={className}>
        <div>
          <button type="button" className={buttonClassName} onClick={handlePrevYear}>
            {'<<'}
          </button>
          <button type="button" className={buttonClassName} onClick={handlePrevMonth}>
            {'<'}
          </button>
        </div>
        <span className={labelClassName}>{label}</span>
        <div>
          <button type="button" className={buttonClassName} onClick={handleNextMonth}>
            {'>'}
          </button>
          <button type="button" className={buttonClassName} onClick={handleNextYear}>
            {'>>'}
          </button>
        </div>
      </div>
    );
  }
);
