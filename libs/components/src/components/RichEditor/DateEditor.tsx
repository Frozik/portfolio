import type { TenorDate, ValueDescriptor } from '@frozik/utils';
import { createSyncedValueDescriptor } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { memo, useState } from 'react';
import { cn } from '../cn';
import { DateSelector } from './components/DateSelector';
import { RichEditor } from './RichEditor';
import styles from './styles.module.scss';

export const DateEditor = memo(
  ({ className, placeholder }: { className?: string; placeholder?: string }) => {
    const [focused, setFocused] = useState(false);

    return (
      <DropdownMenu.Root open={focused} onOpenChange={setFocused}>
        <DropdownMenu.Trigger asChild>
          <RichEditor
            className={cn(styles.editor, className)}
            onFocusChanges={setFocused}
            placeholder={`<span class="${styles.placeholder}">${placeholder}</span>`}
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={4}>
            <DateSelector
              today={createSyncedValueDescriptor(Temporal.PlainDate.from('2021-01-29'))}
              yearMonth={Temporal.PlainYearMonth.from('2021-01')}
              tenors={
                createSyncedValueDescriptor([
                  { tenor: 'TOD', date: Temporal.PlainDate.from('2021-01-01') },
                  { tenor: 'TOM', date: Temporal.PlainDate.from('2021-01-04') },
                  { tenor: 'SPOT', date: Temporal.PlainDate.from('2021-01-05') },
                  { tenor: '1W', date: Temporal.PlainDate.from('2021-01-08') },
                ]) as ValueDescriptor<TenorDate[]>
              }
              weekendDays={
                createSyncedValueDescriptor([
                  Temporal.PlainDate.from('2021-01-02'),
                  Temporal.PlainDate.from('2021-01-03'),
                  Temporal.PlainDate.from('2021-01-09'),
                  Temporal.PlainDate.from('2021-01-10'),
                  Temporal.PlainDate.from('2021-01-16'),
                  Temporal.PlainDate.from('2021-01-17'),
                  Temporal.PlainDate.from('2021-01-23'),
                  Temporal.PlainDate.from('2021-01-24'),
                  Temporal.PlainDate.from('2021-01-30'),
                  Temporal.PlainDate.from('2021-01-31'),
                ]) as ValueDescriptor<Temporal.PlainDate[]>
              }
              calendarClassName={styles.calendar}
              calendarDayCellClassName={styles.calendarDayCell}
              calendarDayCellTodayClassName={styles.calendarDayCellToday}
              calendarDayCellSelectedClassName={styles.calendarDayCellSelected}
              calendarDayCellWeekendClassName={styles.calendarDayCellWeekend}
              calendarDayCellTenorClassName={styles.calendarDayCellTenor}
              calendarDayCellOverflowClassName={styles.calendarDayCellOverflow}
              calendarHeaderClassName={styles.calendarDayCellHeader}
              selectedDate={Temporal.PlainDate.from('2021-01-24')}
              minDate={Temporal.PlainDate.from('2021-01-04')}
              maxDate={Temporal.PlainDate.from('2021-01-30')}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }
);
