import type { Temporal } from '@js-temporal/polyfill';
import { memo, useMemo } from 'react';
import { useFunction } from '../../../hooks';
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
          'flex size-7 cursor-pointer items-center justify-center rounded-sm border border-transparent p-0 font-inherit text-sm text-text-secondary hover:bg-brand-500',
          // Background priority (low → high): transparent → today → weekend → weekend+today → selected → weekend+selected
          !cell.weekend && !cell.selected && !cell.today && 'bg-transparent',
          cell.today && !cell.weekend && !cell.selected && 'bg-brand-500/20',
          cell.weekend && !cell.today && !cell.selected && 'bg-error/15',
          cell.weekend && cell.today && !cell.selected && 'bg-error/25',
          cell.selected && !cell.weekend && 'bg-brand-500/70',
          cell.weekend && cell.selected && 'bg-error/40',
          // Text
          cell.today && 'font-bold text-text',
          cell.overflow && 'pointer-events-none text-text-muted',
          cell.overflow && (cell.selected || cell.today) && 'text-text-secondary'
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
