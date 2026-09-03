import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_STEP_METERS } from '../constants';
import { updateSettings } from './settings-edits';
import { createDefaultSitePlan } from './site-plan';

describe('settings edits', () => {
  it('changes only the field it is given', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, { gridStepMeters: 0.25 });

    expect(next).toEqual({ ...settings, gridStepMeters: 0.25 });
    expect(settings.gridStepMeters).toBe(DEFAULT_GRID_STEP_METERS);
  });

  it('merges the location instead of replacing it', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, { location: { latitudeDegrees: 55.75 } });

    expect(next.location).toEqual({ ...settings.location, latitudeDegrees: 55.75 });
  });

  it('keeps the location identity when nothing about it changes', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, { setbackMeters: 5 });

    expect(next.location).toBe(settings.location);
  });

  it('applies several fields at once', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, {
      isSnapEnabled: false,
      heightfieldTargetResolution: 128,
      contourIntervalMeters: 0.25,
      location: { timeZoneId: 'Europe/Berlin', northOffsetDegrees: 15 },
    });

    expect(next).toEqual({
      ...settings,
      isSnapEnabled: false,
      heightfieldTargetResolution: 128,
      contourIntervalMeters: 0.25,
      location: { ...settings.location, timeZoneId: 'Europe/Berlin', northOffsetDegrees: 15 },
    });
  });

  it('folds a north offset written outside a single turn into one', () => {
    const settings = createDefaultSitePlan().settings;

    expect(updateSettings(settings, { location: { northOffsetDegrees: 375 } }).location).toEqual({
      ...settings.location,
      northOffsetDegrees: 15,
    });
    expect(updateSettings(settings, { location: { northOffsetDegrees: -90 } }).location).toEqual({
      ...settings.location,
      northOffsetDegrees: 270,
    });
  });
});
