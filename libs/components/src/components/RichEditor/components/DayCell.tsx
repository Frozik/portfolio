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
          'flex size-7 cursor-pointer items-center justify-center border border-transparent p-0 font-mono text-[13px] text-landing-fg-dim transition-colors hover:border-landing-accent hover:text-landing-fg',
          // Background priority (low → high): transparent → today → weekend → weekend+today → selected → weekend+selected
          !cell.weekend && !cell.selected && !cell.today && 'bg-transparent',
          cell.today && !cell.weekend && !cell.selected && 'bg-landing-accent/15',
          cell.weekend && !cell.today && !cell.selected && 'bg-landing-red/12',
          cell.weekend && cell.today && !cell.selected && 'bg-landing-red/20',
          cell.selected && !cell.weekend && 'bg-landing-accent/55 text-landing-fg',
          cell.weekend && cell.selected && 'bg-landing-red/40 text-landing-fg',
          // Text
          cell.today && 'font-semibold text-landing-fg',
          cell.overflow && 'pointer-events-none text-landing-fg-faint',
          cell.overflow && (cell.selected || cell.today) && 'text-landing-fg-dim'
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
