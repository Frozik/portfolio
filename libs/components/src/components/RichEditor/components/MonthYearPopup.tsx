import type { MouseEvent } from 'react';
import { memo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { useEventCallback } from 'usehooks-ts';

import type { ICalendarAriaLabels } from '../defs';
import { DoubleChevronIcon } from './icons';
import styles from '../styles.module.css';

const MONTHS_IN_YEAR = 12;

/**
 * The months of one year, the year stepped with the
 * arrows. The buttons never take focus: the field keeps the keyboard, and
 * typing stays the quick way in.
 */
export const MonthYearPopup = memo(
  ({
    value,
    initialYear,
    locale,
    ariaLabels,
    onSelect,
  }: {
    readonly value: Temporal.PlainYearMonth | undefined;
    readonly initialYear: number;
    readonly locale: string;
    readonly ariaLabels: ICalendarAriaLabels;
    readonly onSelect: (value: Temporal.PlainYearMonth) => void;
  }) => {
    const [year, setYear] = useState(value?.year ?? initialYear);
    const keepFieldFocused = useEventCallback((event: MouseEvent) => event.preventDefault());
    const handlePreviousYear = useEventCallback(() => setYear(current => current - 1));
    const handleNextYear = useEventCallback(() => setYear(current => current + 1));

    return (
      <div className={styles.popoverContent} onMouseDown={keepFieldFocused}>
        <div className={styles.calendarPane} role="group" aria-label={ariaLabels.monthPicker}>
          <div className={styles.monthNavigator}>
            <button
              type="button"
              tabIndex={-1}
              className={styles.monthNavigatorBtn}
              aria-label={ariaLabels.previousYear}
              onClick={handlePreviousYear}
            >
              <DoubleChevronIcon direction="left" />
            </button>
            <span className={styles.monthNavigatorLabel} aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              tabIndex={-1}
              className={styles.monthNavigatorBtn}
              aria-label={ariaLabels.nextYear}
              onClick={handleNextYear}
            >
              <DoubleChevronIcon direction="right" />
            </button>
          </div>
          <div className={styles.monthGrid}>
            {Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
              const month = Temporal.PlainYearMonth.from({ year, month: index + 1 });
              const isSelected = value?.equals(month) === true;
              return (
                <button
                  key={month.month}
                  type="button"
                  tabIndex={-1}
                  className={styles.dayCell}
                  data-selected={isSelected || undefined}
                  aria-pressed={isSelected}
                  aria-label={month
                    .toPlainDate({ day: 1 })
                    .toLocaleString(locale, { month: 'long', year: 'numeric' })}
                  onClick={() => onSelect(month)}
                >
                  {month.toPlainDate({ day: 1 }).toLocaleString(locale, { month: 'short' })}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
