import type { Ref } from 'react';
import { memo } from 'react';
import type { Temporal } from 'temporal-polyfill';

import { useFunction } from '../../../hooks/useFunction';
import styles from '../styles.module.css';

export const DayCell = memo(
  ({
    ref,
    date,
    weekend,
    today,
    selected,
    active,
    overflow,
    onSelect,
    locale,
  }: {
    readonly ref?: Ref<HTMLButtonElement>;
    readonly date: Temporal.PlainDate;
    readonly weekend: boolean;
    readonly today: boolean;
    readonly selected: boolean;
    /** The one cell in the grid the keyboard lands on. */
    readonly active: boolean;
    /** Outside the shown month or the allowed range: displayed, not selectable. */
    readonly overflow: boolean;
    readonly onSelect: (date: Temporal.PlainDate) => void;
    readonly locale: string;
  }) => {
    const handleClick = useFunction(() => onSelect(date));

    return (
      <button
        ref={ref}
        type="button"
        className={styles.dayCell}
        tabIndex={active ? 0 : -1}
        disabled={overflow}
        data-weekend={weekend || undefined}
        data-today={today || undefined}
        data-selected={selected || undefined}
        aria-label={date.toLocaleString(locale, { dateStyle: 'long' })}
        aria-pressed={selected}
        aria-current={today ? 'date' : undefined}
        onClick={handleClick}
      >
        {date.day}
      </button>
    );
  }
);
