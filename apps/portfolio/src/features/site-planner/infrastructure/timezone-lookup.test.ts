import { describe, expect, it } from 'vitest';

import { lookupTimeZoneId } from './timezone-lookup';

describe('lookupTimeZoneId', () => {
  it('places the plan default — Saint Petersburg — in Europe/Moscow', () => {
    expect(lookupTimeZoneId(59.94, 30.31)).toBe('Europe/Moscow');
  });

  it('places points on other continents', () => {
    expect(lookupTimeZoneId(48.8566, 2.3522)).toBe('Europe/Paris');
    expect(lookupTimeZoneId(-33.8688, 151.2093)).toBe('Australia/Sydney');
  });

  it('answers a zone for open water rather than nothing', () => {
    expect(lookupTimeZoneId(0, 0)).toBe('Etc/GMT');
  });

  it('answers undefined for coordinates off the globe', () => {
    expect(lookupTimeZoneId(200, 30)).toBeUndefined();
    expect(lookupTimeZoneId(Number.NaN, Number.NaN)).toBeUndefined();
  });
});
