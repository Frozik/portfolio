import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { computeLunarEvents } from './lunarEvents';
import { computeLunarPosition } from './lunarPosition';

const SAINT_PETERSBURG = { latitudeDegrees: 59.9386, longitudeDegrees: 30.3141 };
const A_JUNE_DAY = Temporal.Instant.from('2026-06-10T12:00:00Z');
/** The upper limb's semidiameter and the residual refraction: the centre sits this far under 0. */
const CENTRE_BELOW_HORIZON_AT_RISE_DEGREES = -0.35;
const CROSSING_TOLERANCE_DEGREES = 0.15;

describe('computeLunarEvents', () => {
  const events = computeLunarEvents(
    A_JUNE_DAY,
    SAINT_PETERSBURG.latitudeDegrees,
    SAINT_PETERSBURG.longitudeDegrees
  );

  it('finds both a rise and a set on an ordinary day', () => {
    expect(events.visibility).toBe('normal');
    expect(events.moonrise).toBeDefined();
    expect(events.moonset).toBeDefined();
  });

  it('keeps both inside the UTC day it was asked about', () => {
    const dayStart = A_JUNE_DAY.toZonedDateTimeISO('UTC').startOfDay().toInstant();
    const dayEnd = dayStart.add({ hours: 24 });

    for (const event of [events.moonrise, events.moonset]) {
      expect(Temporal.Instant.compare(event ?? dayStart, dayStart)).toBeGreaterThanOrEqual(0);
      expect(Temporal.Instant.compare(event ?? dayStart, dayEnd)).toBeLessThan(0);
    }
  });

  it('lands the rise where the upper limb touches the horizon', () => {
    const atRise = computeLunarPosition(
      events.moonrise ?? A_JUNE_DAY,
      SAINT_PETERSBURG.latitudeDegrees,
      SAINT_PETERSBURG.longitudeDegrees
    );

    expect(Math.abs(atRise.altitudeDegrees - CENTRE_BELOW_HORIZON_AT_RISE_DEGREES)).toBeLessThan(
      CROSSING_TOLERANCE_DEGREES
    );
  });
});
