import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';
import type { MultiPolygon } from '../geometry/polygon-types';
import type { TrenchProfile } from '../terrain/trench-profile';
import { buildTrenchProfile } from '../terrain/trench-profile';
import { collectRouteWarnings } from './route-warnings';
import type { UtilityRoute, UtilityRouteId } from './routing';
import { createUtilityRoute, trenchDepthMeters } from './routing';

const FROST_DEPTH = 1.5;

function makeRoute(system: UtilityRoute['system'], points: readonly Vector2[]): UtilityRoute {
  return { ...createUtilityRoute({ system, points }) };
}

function profileOf(
  route: UtilityRoute,
  sampleElevation: (position: Vector2) => number
): TrenchProfile {
  const profile = buildTrenchProfile({
    points: route.points,
    system: route.system,
    burialDepthMeters: trenchDepthMeters(route.system, FROST_DEPTH),
    diameterMeters: route.diameterMeters ?? 0.11,
    sampleElevation,
  });

  if (profile === undefined) {
    throw new Error('profile expected');
  }

  return profile;
}

function collect(
  routes: readonly UtilityRoute[],
  {
    sampleElevation = () => 10,
    driveablePolygons = [],
  }: {
    readonly sampleElevation?: (position: Vector2) => number;
    readonly driveablePolygons?: MultiPolygon;
  } = {}
) {
  const profiles = new Map<UtilityRouteId, TrenchProfile>(
    routes.map(route => [route.id, profileOf(route, sampleElevation)])
  );
  const burialDepths = new Map<UtilityRouteId, number>(
    routes.map(route => [route.id, trenchDepthMeters(route.system, FROST_DEPTH)])
  );

  return collectRouteWarnings({
    routes,
    profiles,
    burialDepths,
    driveablePolygons,
  });
}

describe('collectRouteWarnings', () => {
  it('finds nothing on a flat plan of well-separated runs', () => {
    const water = makeRoute('water', [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const sewer = makeRoute('sewer', [
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ]);

    expect(collect([water, sewer])).toEqual([]);
  });

  it('flags a sewer run risen above its norm burial on falling terrain', () => {
    const sewer = makeRoute('sewer', [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);

    // The ground falls two metres over the run, far faster than the 2% pipe.
    const warnings = collect([sewer], {
      sampleElevation: position => 10 - position.x / 10,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe('shallow-depth');
    expect(warnings[0].requiredMeters).toBeCloseTo(1.8);
  });

  it('flags parallel company closer than the СП separation', () => {
    const water = makeRoute('water', [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const sewer = makeRoute('sewer', [
      { x: 0, y: 0.5 },
      { x: 10, y: 0.5 },
    ]);

    const warnings = collect([water, sewer]);
    const separation = warnings.find(warning => warning.kind === 'parallel-separation');

    expect(separation).toBeDefined();
    expect(separation?.requiredMeters).toBeCloseTo(1.5);
    expect(separation?.actualMeters).toBeCloseTo(0.5);
  });

  it('flags thin cover where a risen run passes under paving', () => {
    const sewer = makeRoute('sewer', [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    // The ground falls three metres over the run: by the far end the pipe
    // holds barely any cover — and that end lies under a driveable apron.
    const apron: MultiPolygon = [
      {
        outer: [
          { x: 15, y: -2 },
          { x: 21, y: -2 },
          { x: 21, y: 2 },
          { x: 15, y: 2 },
        ],
        holes: [],
      },
    ];

    const warnings = collect([sewer], {
      sampleElevation: position => 10 - (position.x * 3) / 20,
      driveablePolygons: apron,
    });

    expect(warnings.some(warning => warning.kind === 'driveable-cover')).toBe(true);
  });

  it('lets a perpendicular crossing pass at any distance', () => {
    const water = makeRoute('water', [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const sewer = makeRoute('sewer', [
      { x: 5, y: -5 },
      { x: 5, y: 5 },
    ]);

    expect(collect([water, sewer])).toEqual([]);
  });
});
