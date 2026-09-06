import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';
import {
  DEFAULT_CONTOUR_INTERVAL_METERS,
  DEFAULT_GRID_STEP_METERS,
  DEFAULT_HEIGHTFIELD_TARGET_RESOLUTION,
  DEFAULT_IS_SNAP_ENABLED,
  DEFAULT_LATITUDE_DEGREES,
  DEFAULT_LONGITUDE_DEGREES,
  DEFAULT_NORTH_OFFSET_DEGREES,
  DEFAULT_SETBACK_METERS,
  DEFAULT_SITE_LENGTH_METERS,
  DEFAULT_SITE_WIDTH_METERS,
  DEFAULT_TIME_ZONE_ID,
} from '../constants';
import type { Meters } from '../units';
import { normalizeTurnDegrees } from '../units';
import type { Building } from './building';
import { DEFAULT_FROST_DEPTH_METERS } from './foundation';
import type { TreeInstance, CarInstance, SitePath } from './plot-objects';
import type { UtilityRoute } from './routing';
import type { ShapeComposition } from './shapes';
import { createRectangle } from './shapes';

export type MarkId = Opaque<'MarkId', string>;

export interface ElevationMark {
  readonly id: MarkId;
  readonly position: Vector2;
  /** Relative to the site datum ("construction zero"), not sea level. */
  readonly elevation: Meters;
}

export interface SiteLocation {
  readonly latitudeDegrees: number;
  readonly longitudeDegrees: number;
  readonly timeZoneId: string;
  /**
   * How far the plan's own north is turned clockwise off the geographic one, in
   * degrees — the convention is stated once, in `view/north-offset.ts`.
   */
  readonly northOffsetDegrees: number;
}

/**
 * The one reading of a location the plan keeps. The north offset is a bearing,
 * so the same plot answers to infinitely many of them; folding it into a single
 * turn is what lets the compass dial, the typed azimuth and the stored plan all
 * show the same figure. A location already canonical is handed back untouched,
 * so an edit to a neighbouring field leaves the sun study's dependency alone.
 */
export function normalizeSiteLocation(location: SiteLocation): SiteLocation {
  const northOffsetDegrees = normalizeTurnDegrees(location.northOffsetDegrees);

  return northOffsetDegrees === location.northOffsetDegrees
    ? location
    : { ...location, northOffsetDegrees };
}

export interface SiteSettings {
  readonly location: SiteLocation;
  readonly gridStepMeters: Meters;
  readonly isSnapEnabled: boolean;
  readonly setbackMeters: Meters;
  readonly heightfieldTargetResolution: number;
  readonly contourIntervalMeters: Meters;
  /**
   * How deep the ground freezes — what every burial norm measures from (R17).
   * Absent in plans saved before the routing stage — read via
   * {@link frostDepthOf}.
   */
  readonly frostDepthMeters?: Meters;
}

/** The plot's frost depth, defaulted for plans that predate the setting. */
export function frostDepthOf(settings: SiteSettings): Meters {
  return settings.frostDepthMeters ?? DEFAULT_FROST_DEPTH_METERS;
}

/**
 * The whole parametric document: immutable and JSON-serialisable, so a plan
 * value doubles as the persistence record and as the undo snapshot.
 */
export interface SitePlan {
  readonly boundary: ShapeComposition;
  readonly elevationMarks: readonly ElevationMark[];
  readonly buildings: readonly Building[];
  readonly trees: readonly TreeInstance[];
  readonly cars: readonly CarInstance[];
  readonly paths: readonly SitePath[];
  /**
   * The site utility trenches. Absent in plans saved before routes existed —
   * read via {@link utilityRoutesOf}.
   */
  readonly utilityRoutes?: readonly UtilityRoute[];
  readonly settings: SiteSettings;
}

/** The plan's trenches, empty for plans that predate the field. */
export function utilityRoutesOf(plan: SitePlan): readonly UtilityRoute[] {
  return plan.utilityRoutes ?? NO_UTILITY_ROUTES;
}

const NO_UTILITY_ROUTES: readonly UtilityRoute[] = [];

export function createMarkId(): MarkId {
  return crypto.randomUUID() as MarkId;
}

/** Mints an identity for a mark the user has just placed or pasted. */
export function createElevationMark({
  position,
  elevation,
}: {
  readonly position: Vector2;
  readonly elevation: Meters;
}): ElevationMark {
  return { id: createMarkId(), position, elevation };
}

export function createDefaultSitePlan(): SitePlan {
  return {
    boundary: {
      terms: [
        {
          operand: createRectangle({
            center: { x: DEFAULT_SITE_WIDTH_METERS / 2, y: DEFAULT_SITE_LENGTH_METERS / 2 },
            width: DEFAULT_SITE_WIDTH_METERS,
            length: DEFAULT_SITE_LENGTH_METERS,
            rotationDegrees: 0,
          }),
          operation: 'union',
        },
      ],
    },
    elevationMarks: [],
    buildings: [],
    trees: [],
    cars: [],
    paths: [],
    utilityRoutes: [],
    settings: {
      location: {
        latitudeDegrees: DEFAULT_LATITUDE_DEGREES,
        longitudeDegrees: DEFAULT_LONGITUDE_DEGREES,
        timeZoneId: DEFAULT_TIME_ZONE_ID,
        northOffsetDegrees: DEFAULT_NORTH_OFFSET_DEGREES,
      },
      gridStepMeters: DEFAULT_GRID_STEP_METERS,
      isSnapEnabled: DEFAULT_IS_SNAP_ENABLED,
      setbackMeters: DEFAULT_SETBACK_METERS,
      heightfieldTargetResolution: DEFAULT_HEIGHTFIELD_TARGET_RESOLUTION,
      contourIntervalMeters: DEFAULT_CONTOUR_INTERVAL_METERS,
      frostDepthMeters: DEFAULT_FROST_DEPTH_METERS,
    },
  };
}
