import { describe, expect, it } from 'vitest';

import { formatMeters } from './shared';

describe('formatMeters', () => {
  it('renders two decimals and the given unit by default', () => {
    expect(formatMeters(12.5, 'm')).toBe('12.50 m');
  });

  it('honours an explicit precision', () => {
    expect(formatMeters(10, 'm', 0)).toBe('10 m');
    expect(formatMeters(0.5, 'm', 1)).toBe('0.5 m');
  });
});
