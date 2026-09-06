import { isNil } from 'lodash-es';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import type { RouteWarning } from '../domain/model/route-warnings';
import { collectRouteWarnings } from '../domain/model/route-warnings';
import type { UtilityRoute, UtilityRouteId } from '../domain/model/routing';
import { DEFAULT_SEWER_DIAMETER_METERS, trenchDepthMeters } from '../domain/model/routing';
import type { Heightfield } from '../domain/terrain/heightfield';
import { sampleHeight } from '../domain/terrain/heightfield';
import type { TrenchProfile } from '../domain/terrain/trench-profile';
import { buildTrenchProfile } from '../domain/terrain/trench-profile';
import type { Meters } from '../domain/units';

/**
 * Every trench resolved against the terrain: the norm burial for its system,
 * a sewer's gravity fall, the digging volume. One map for the panels, the
 * warning pass and the report alike.
 */
export function buildTrenchProfiles(
  routes: readonly UtilityRoute[],
  heightfield: Heightfield,
  frostDepthMeters: Meters
): ReadonlyMap<UtilityRouteId, TrenchProfile> {
  const profiles = new Map<UtilityRouteId, TrenchProfile>();

  for (const route of routes) {
    const profile = buildTrenchProfile({
      points: route.points,
      system: route.system,
      burialDepthMeters: trenchDepthMeters(route.system, frostDepthMeters),
      diameterMeters: route.diameterMeters ?? DEFAULT_SEWER_DIAMETER_METERS,
      sampleElevation: position => sampleHeight(heightfield, position.x, position.y),
    });

    if (!isNil(profile)) {
      profiles.set(route.id, profile);
    }
  }

  return profiles;
}

/** The advisory findings of the norm pass, over every drawn trench. */
export function collectTrenchWarnings({
  routes,
  profiles,
  frostDepthMeters,
  driveablePolygons,
}: {
  readonly routes: readonly UtilityRoute[];
  readonly profiles: ReadonlyMap<UtilityRouteId, TrenchProfile>;
  readonly frostDepthMeters: Meters;
  readonly driveablePolygons: MultiPolygon;
}): readonly RouteWarning[] {
  return collectRouteWarnings({
    routes,
    profiles,
    burialDepths: new Map(
      routes.map(route => [route.id, trenchDepthMeters(route.system, frostDepthMeters)])
    ),
    driveablePolygons,
  });
}
