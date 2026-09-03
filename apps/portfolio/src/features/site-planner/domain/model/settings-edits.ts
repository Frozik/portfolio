import { isNil } from 'lodash-es';
import type { Meters } from '../units';
import type { SiteSettings } from './site-plan';
import { normalizeSiteLocation } from './site-plan';

/** Where the plot is on Earth, as the settings panel edits it field by field. */
export interface SiteLocationChanges {
  readonly latitudeDegrees?: number;
  readonly longitudeDegrees?: number;
  readonly timeZoneId?: string;
  readonly northOffsetDegrees?: number;
}

export interface SiteSettingsChanges {
  readonly location?: SiteLocationChanges;
  readonly gridStepMeters?: Meters;
  readonly isSnapEnabled?: boolean;
  readonly setbackMeters?: Meters;
  readonly heightfieldTargetResolution?: number;
  readonly contourIntervalMeters?: Meters;
  readonly frostDepthMeters?: Meters;
}

/**
 * Settings edits, one field at a time. The location is merged rather than
 * replaced — a panel that edits a latitude must not have to restate the time
 * zone — and it keeps its identity when nothing about it changes, so the sun
 * study is left alone by an edit to the grid step.
 */
export function updateSettings(settings: SiteSettings, changes: SiteSettingsChanges): SiteSettings {
  const { location, ...flatChanges } = changes;

  return {
    ...settings,
    ...flatChanges,
    location: isNil(location)
      ? settings.location
      : normalizeSiteLocation({ ...settings.location, ...location }),
  };
}
