import type { TenorDate } from '@frozik/utils';
import type { Temporal } from '@js-temporal/polyfill';
import { memo, useMemo } from 'react';
import { useFunction } from '../../../hooks';
import { cn } from '../../cn';

export const DayCell = memo(
  ({
    cell,
    gridColumn,
    gridRow,
    calendarDayCellClassName,
    calendarDayCellTodayClassName,
    calendarDayCellSelectedClassName,
    calendarDayCellWeekendClassName,
    calendarDayCellTenorClassName,
    calendarDayCellOverflowClassName,
    onSelectCalendarDate,
  }: {
    cell: {
      date: Temporal.PlainDate;
      tenors: TenorDate[];
      weekend: boolean;
      today: boolean;
      selected: boolean;
      overflow: boolean;
    };
    gridColumn: number;
    gridRow: number;
    calendarDayCellClassName: string;
    calendarDayCellTodayClassName: string;
    calendarDayCellSelectedClassName: string;
    calendarDayCellWeekendClassName: string;
    calendarDayCellTenorClassName: string;
    calendarDayCellOverflowClassName: string;
    onSelectCalendarDate?: (date: Temporal.PlainDate) => void;
  }) => {
    const handleDaySelect = useFunction(() => {
      onSelectCalendarDate?.(cell.date);
    });

    const className = useMemo(
      () =>
        cell.overflow
          ? cn(calendarDayCellClassName, calendarDayCellOverflowClassName, {
              [calendarDayCellSelectedClassName]: cell.selected,
              [calendarDayCellTodayClassName]: cell.today,
            })
          : cn(calendarDayCellClassName, {
              [calendarDayCellTodayClassName]: cell.today,
              [calendarDayCellSelectedClassName]: cell.selected,
              [calendarDayCellWeekendClassName]: cell.weekend,
              [calendarDayCellTenorClassName]: cell.tenors.length > 0,
            }),
      [
        cell.overflow,
        cell.selected,
        cell.today,
        cell.weekend,
        cell.tenors.length,
        calendarDayCellClassName,
        calendarDayCellOverflowClassName,
        calendarDayCellSelectedClassName,
        calendarDayCellTodayClassName,
        calendarDayCellWeekendClassName,
        calendarDayCellTenorClassName,
      ]
    );

    return (
      <div
        key={cell.date.toString()}
        style={{ gridColumn, gridRow }}
        className={className}
        title={cell.tenors.map(({ tenor }) => tenor).join(', ')}
        onClick={handleDaySelect}
      >
        {cell.date.day}
      </div>
    );
  }
);
