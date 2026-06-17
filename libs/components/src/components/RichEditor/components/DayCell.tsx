import { memo, useMemo } from 'react';
import type { Temporal } from 'temporal-polyfill';
import { useFunction } from '../../../hooks/useFunction';
import { cn } from '../../cn';

export const DayCell = memo(
  ({
    cell,
    gridColumn,
    gridRow,
    onSelectCalendarDate,
    monthNames,
  }: {
    cell: {
      date: Temporal.PlainDate;
      weekend: boolean;
      today: boolean;
      selected: boolean;
      overflow: boolean;
    };
    gridColumn: number;
    gridRow: number;
    onSelectCalendarDate?: (date: Temporal.PlainDate) => void;
    monthNames: readonly string[];
  }) => {
    const handleDaySelect = useFunction(() => {
      onSelectCalendarDate?.(cell.date);
    });

    const className = useMemo(
      () =>
        cn(
          'flex size-7 cursor-pointer items-center justify-center border border-transparent p-0 font-mono text-[13px] text-[var(--color-landing-fg-dim,#a2adbd)] transition-colors hover:border-[var(--color-landing-accent,#60a5fa)] hover:text-[var(--color-landing-fg,#e7ecf3)]',
          // Background priority (low → high): transparent → today → weekend → weekend+today → selected → weekend+selected
          !cell.weekend && !cell.selected && !cell.today && 'bg-transparent',
          cell.today &&
            !cell.weekend &&
            !cell.selected &&
            'bg-[color-mix(in_oklab,var(--color-landing-accent,#60a5fa)_15%,transparent)]',
          cell.weekend &&
            !cell.today &&
            !cell.selected &&
            'bg-[color-mix(in_oklab,var(--color-landing-red,#ff4f58)_12%,transparent)]',
          cell.weekend &&
            cell.today &&
            !cell.selected &&
            'bg-[color-mix(in_oklab,var(--color-landing-red,#ff4f58)_20%,transparent)]',
          cell.selected &&
            !cell.weekend &&
            'bg-[color-mix(in_oklab,var(--color-landing-accent,#60a5fa)_55%,transparent)] text-[var(--color-landing-fg,#e7ecf3)]',
          cell.weekend &&
            cell.selected &&
            'bg-[color-mix(in_oklab,var(--color-landing-red,#ff4f58)_40%,transparent)] text-[var(--color-landing-fg,#e7ecf3)]',
          // Text
          cell.today && 'font-semibold text-[var(--color-landing-fg,#e7ecf3)]',
          cell.overflow && 'pointer-events-none text-[var(--color-landing-fg-faint,#76819a)]',
          cell.overflow &&
            (cell.selected || cell.today) &&
            'text-[var(--color-landing-fg-dim,#a2adbd)]'
        ),
      [cell.overflow, cell.selected, cell.today, cell.weekend]
    );

    const fullDateLabel = useMemo(
      () => `${cell.date.day} ${monthNames[cell.date.month - 1]} ${cell.date.year}`,
      [cell.date.day, cell.date.month, cell.date.year, monthNames]
    );

    return (
      <button
        type="button"
        key={cell.date.toString()}
        style={{ gridColumn, gridRow }}
        className={className}
        tabIndex={-1}
        aria-label={fullDateLabel}
        aria-pressed={cell.selected}
        aria-current={cell.today ? 'date' : undefined}
        onClick={handleDaySelect}
      >
        {cell.date.day}
      </button>
    );
  }
);
