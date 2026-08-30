import { describe, expect, it } from 'vitest';

import { isValidTimeZoneId } from './time-zone';

describe('isValidTimeZoneId', () => {
  it('accepts an IANA zone the runtime resolves', () => {
    expect(isValidTimeZoneId('Europe/Moscow')).toBe(true);
    expect(isValidTimeZoneId('UTC')).toBe(true);
  });

  it('rejects a name no zone answers to', () => {
    expect(isValidTimeZoneId('Europe/Mosco')).toBe(false);
    expect(isValidTimeZoneId('')).toBe(false);
  });
});
