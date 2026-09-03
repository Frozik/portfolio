import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SiteLocation } from '../domain/model/site-plan';
import { SunStudy } from './SunStudy';

/** Moscow, north up — the default a fresh plan opens with. */
const LOCATION: SiteLocation = {
  latitudeDegrees: 55.75,
  longitudeDegrees: 37.62,
  timeZoneId: 'Europe/Moscow',
  northOffsetDegrees: 0,
};

describe('SunStudy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens at midday of the studied date rather than at a carried-over time', () => {
    const study = new SunStudy(() => LOCATION);
    const { sunriseMinutes, sunsetMinutes } = study.dayWindow;

    expect(study.timeOverrideMinutes).toBeUndefined();
    // The clamp works in whole minutes, so midday lands on one.
    expect(study.timeMinutes).toBe(Math.ceil((sunriseMinutes + sunsetMinutes) / 2));
  });

  it('keeps a chosen time inside the daylight of the day being studied', () => {
    const study = new SunStudy(() => LOCATION);

    study.setTimeMinutes(0);

    expect(study.timeMinutes).toBe(study.dayWindow.sunriseMinutes);

    study.setTimeMinutes(24 * 60);

    expect(study.timeMinutes).toBe(study.dayWindow.sunsetMinutes);
  });

  it('plays the day and wraps back to sunrise at dusk', () => {
    const study = new SunStudy(() => LOCATION);

    study.setTimeMinutes(study.dayWindow.sunsetMinutes);
    study.toggleAnimation();

    expect(study.isAnimating).toBe(true);

    vi.advanceTimersByTime(50);

    expect(study.timeMinutes).toBe(study.dayWindow.sunriseMinutes);
  });

  it('stops the timer when the study is closed — nothing keeps ticking unseen', () => {
    const study = new SunStudy(() => LOCATION);

    study.toggleOpen();
    study.toggleAnimation();
    study.toggleOpen();

    expect(study.isOpen).toBe(false);
    expect(study.isAnimating).toBe(false);

    const before = study.timeMinutes;

    vi.advanceTimersByTime(500);

    expect(study.timeMinutes).toBe(before);
  });

  it('turns the light with the plan’s own north', () => {
    const northUp = new SunStudy(() => LOCATION);
    const turned = new SunStudy(() => ({ ...LOCATION, northOffsetDegrees: 90 }));

    northUp.setTimeMinutes(northUp.dayWindow.sunriseMinutes + 240);
    turned.setTimeMinutes(turned.dayWindow.sunriseMinutes + 240);

    // Same sun in the sky, a different direction on the plan.
    expect(turned.position.azimuthRadians).toBeCloseTo(northUp.position.azimuthRadians, 6);
    expect(turned.light.direction).not.toEqual(northUp.light.direction);
  });
});
