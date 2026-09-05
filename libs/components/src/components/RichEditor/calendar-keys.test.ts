import { EDayOfWeek } from '@frozik/utils/date/constants';
import { Temporal } from 'temporal-polyfill';

import { clampDate, moveActiveDate } from './calendar-keys';

const date = (iso: string) => Temporal.PlainDate.from(iso);
const move = (from: string, key: string, shiftKey = false) =>
  moveActiveDate(date(from), key, shiftKey, EDayOfWeek.Monday)?.toString();

describe('moveActiveDate', () => {
  it('walks days with the horizontal arrows and weeks with the vertical ones', () => {
    expect(move('2026-03-10', 'ArrowLeft')).toBe('2026-03-09');
    expect(move('2026-03-10', 'ArrowRight')).toBe('2026-03-11');
    expect(move('2026-03-10', 'ArrowUp')).toBe('2026-03-03');
    expect(move('2026-03-10', 'ArrowDown')).toBe('2026-03-17');
  });

  it('crosses month boundaries', () => {
    expect(move('2026-03-01', 'ArrowLeft')).toBe('2026-02-28');
  });

  it('pages by month, and by year with Shift', () => {
    expect(move('2026-03-31', 'PageUp')).toBe('2026-02-28');
    expect(move('2026-03-10', 'PageDown')).toBe('2026-04-10');
    expect(move('2024-02-29', 'PageDown', true)).toBe('2025-02-28');
  });

  it('jumps to the first and last day of the week', () => {
    expect(move('2026-03-11', 'Home')).toBe('2026-03-09');
    expect(move('2026-03-11', 'End')).toBe('2026-03-15');
  });

  it('respects the configured first day of the week', () => {
    expect(moveActiveDate(date('2026-03-11'), 'Home', false, EDayOfWeek.Sunday)?.toString()).toBe(
      '2026-03-08'
    );
  });

  it('ignores keys the grid does not use', () => {
    expect(move('2026-03-11', 'a')).toBeUndefined();
  });
});

describe('clampDate', () => {
  it('keeps the date inside the allowed range', () => {
    expect(clampDate(date('2026-01-01'), date('2026-02-01'), undefined).toString()).toBe(
      '2026-02-01'
    );
    expect(clampDate(date('2026-12-31'), undefined, date('2026-06-30')).toString()).toBe(
      '2026-06-30'
    );
    expect(clampDate(date('2026-03-10'), date('2026-01-01'), date('2026-12-31')).toString()).toBe(
      '2026-03-10'
    );
  });
});
