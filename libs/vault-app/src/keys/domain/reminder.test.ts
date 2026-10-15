import type { Milliseconds } from '@frozik/utils/date/types';

import { REMINDER_INTERVAL_MS, reminderDue } from './reminder';

const TYPED_AT = 1_700_000_000_000 as Milliseconds;
const HOUR_MS = 60 * 60 * 1000;

describe('the master password reminder', () => {
  it('is not due six days and twenty-three hours after the password was typed', () => {
    expect(reminderDue(TYPED_AT, TYPED_AT + REMINDER_INTERVAL_MS - HOUR_MS)).toBe(false);
  });

  it('is due seven days after', () => {
    expect(reminderDue(TYPED_AT, TYPED_AT + REMINDER_INTERVAL_MS)).toBe(true);
  });

  it('is never due before the password was first typed on this device', () => {
    expect(reminderDue(null, TYPED_AT + 10 * REMINDER_INTERVAL_MS)).toBe(false);
  });
});
