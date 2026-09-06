import { describe, expect, it } from 'vitest';
import { createBuildingId } from './building';
import { createUtilityEntry } from './foundation';
import { createCar, createPathId, createTreeId } from './plot-objects';
import { createUtilityRoute } from './routing';
import type { CsgTerm } from './shapes';
import { createCircle, createRectangle, createShapeId } from './shapes';
import type { SitePlan } from './site-plan';
import { createDefaultSitePlan, createMarkId, frostDepthOf, utilityRoutesOf } from './site-plan';
import { parseSnapshot, serializeSitePlan } from './snapshot';
import { CURRENT_SNAPSHOT_VERSION } from './snapshot-migrations';
import { createRoofZoneLabel, createStorey } from './storeys';
import { createWall } from './walls';

/** A document exactly as version 1 of the format wrote it, `shape` field and all. */
const LEGACY_FLAT_TERM_SNAPSHOT = JSON.stringify({
  version: 1,
  plan: {
    boundary: {
      terms: [
        {
          shape: {
            kind: 'rectangle',
            id: 'e2f8a0a4-0000-4000-8000-000000000001',
            center: { x: 15, y: 20 },
            width: 30,
            length: 40,
            rotationDegrees: 0,
          },
          operation: 'union',
        },
        {
          shape: {
            kind: 'circle',
            id: 'e2f8a0a4-0000-4000-8000-000000000002',
            center: { x: 5, y: 5 },
            radius: 3,
          },
          operation: 'subtract',
        },
      ],
    },
    elevationMarks: [
      { id: 'e2f8a0a4-0000-4000-8000-000000000003', position: { x: 3, y: 3 }, elevation: -0.4 },
    ],
    house: {
      composition: {
        terms: [
          {
            shape: {
              kind: 'rectangle',
              id: 'e2f8a0a4-0000-4000-8000-000000000004',
              center: { x: 12, y: 18 },
              width: 9,
              length: 12,
              rotationDegrees: 15,
            },
            operation: 'union',
          },
        ],
      },
      padElevationMode: 'terrain-mean',
      wallHeight: 3,
    },
    trees: [
      {
        id: 'e2f8a0a4-0000-4000-8000-000000000005',
        species: 'conifer',
        position: { x: 22, y: 30 },
        crownRadius: 2.5,
        height: 7,
      },
    ],
    paths: [],
    settings: {
      location: {
        latitudeDegrees: 55.75,
        longitudeDegrees: 37.62,
        timeZoneId: 'Europe/Moscow',
        northOffsetDegrees: 0,
      },
      gridStepMeters: 0.5,
      isSnapEnabled: true,
      setbackMeters: 3,
      heightfieldTargetResolution: 96,
      contourIntervalMeters: 0.5,
    },
  },
});

/**
 * A document exactly as version 2 of the format wrote it: terms already hold
 * operands, trees still name the conifer family, and there is no car anywhere.
 */
const LEGACY_PRE_CATALOG_SNAPSHOT = JSON.stringify({
  version: 2,
  plan: {
    boundary: {
      terms: [
        {
          operand: {
            kind: 'rectangle',
            id: 'e2f8a0a4-0000-4000-8000-000000000011',
            center: { x: 15, y: 20 },
            width: 30,
            length: 40,
            rotationDegrees: 0,
          },
          operation: 'union',
        },
      ],
    },
    elevationMarks: [],
    house: undefined,
    trees: [
      {
        id: 'e2f8a0a4-0000-4000-8000-000000000012',
        species: 'conifer',
        position: { x: 22, y: 30 },
        crownRadius: 2.5,
        height: 7,
      },
      {
        id: 'e2f8a0a4-0000-4000-8000-000000000013',
        species: 'deciduous',
        position: { x: 25, y: 30 },
        crownRadius: 3,
        height: 8,
      },
    ],
    paths: [],
    settings: {
      location: {
        latitudeDegrees: 55.75,
        longitudeDegrees: 37.62,
        timeZoneId: 'Europe/Moscow',
        northOffsetDegrees: 0,
      },
      gridStepMeters: 0.5,
      isSnapEnabled: true,
      setbackMeters: 3,
      heightfieldTargetResolution: 96,
      contourIntervalMeters: 0.5,
    },
  },
});

/** A chain of groups `depth` levels deep, with a rectangle at the bottom. */
function nestGroups(depth: number): CsgTerm {
  let term: CsgTerm = {
    operand: createRectangle({
      center: { x: 1, y: 1 },
      width: 1,
      length: 1,
      rotationDegrees: 0,
    }),
    operation: 'union',
  };

  for (let level = 0; level < depth; level += 1) {
    term = {
      operand: { kind: 'group', id: createShapeId(), terms: [term] },
      operation: 'union',
    };
  }

  return term;
}

function createRichSitePlan(): SitePlan {
  const defaultPlan = createDefaultSitePlan();

  return {
    ...defaultPlan,
    boundary: {
      terms: [
        ...defaultPlan.boundary.terms,
        {
          operand: {
            kind: 'group',
            id: createShapeId(),
            terms: [
              { operand: createCircle({ center: { x: 4, y: 4 }, radius: 2 }), operation: 'union' },
              {
                operand: createCircle({ center: { x: 4, y: 4 }, radius: 1 }),
                operation: 'subtract',
              },
            ],
          },
          operation: 'subtract',
        },
      ],
    },
    elevationMarks: [{ id: createMarkId(), position: { x: 3, y: 3 }, elevation: -0.4 }],
    buildings: [
      {
        id: createBuildingId(),
        name: 'Дом',
        composition: {
          terms: [
            {
              operand: createRectangle({
                center: { x: 12, y: 18 },
                width: 9,
                length: 12,
                rotationDegrees: 15,
              }),
              operation: 'union',
            },
          ],
        },
        padElevationMode: 'manual',
        manualPadElevation: 0.35,
        wallHeight: 3,
      },
    ],
    trees: [
      {
        id: createTreeId(),
        species: 'deciduous',
        position: { x: 22, y: 30 },
        crownRadius: 2.5,
        height: 7,
      },
      {
        id: createTreeId(),
        species: 'thuja',
        position: { x: 24, y: 30 },
        crownRadius: 0.8,
        height: 4,
      },
    ],
    cars: [createCar({ position: { x: 6, y: 4 }, rotationDegrees: 45 })],
    paths: [
      {
        id: createPathId(),
        points: [
          { position: { x: 0, y: 0 }, width: 1.2 },
          { position: { x: 5, y: 5 }, width: 1.2 },
        ],
      },
    ],
  };
}

function serializeWith(plan: unknown, version: number = CURRENT_SNAPSHOT_VERSION): string {
  return JSON.stringify({ version, plan });
}

describe('serializeSitePlan / parseSnapshot', () => {
  it('round-trips the default plan', () => {
    const plan = createDefaultSitePlan();

    expect(parseSnapshot(serializeSitePlan(plan))).toEqual(plan);
  });

  it('round-trips a plan with a house, marks, trees, cars and paths', () => {
    const plan = createRichSitePlan();

    expect(parseSnapshot(serializeSitePlan(plan))).toEqual(plan);
  });

  it('accepts a building saved before foundations and entries existed', () => {
    const plan = createRichSitePlan();
    const legacyBuildings = plan.buildings.map(building => {
      const { foundation, entries, ...withoutFoundation } = building;

      return withoutFoundation;
    });
    const parsed = parseSnapshot(serializeWith({ ...plan, buildings: legacyBuildings }));

    expect(parsed).toBeDefined();
    expect(parsed?.buildings[0]?.foundation).toBeUndefined();
  });

  it('round-trips a foundation and its utility entries', () => {
    const plan = createRichSitePlan();
    const withEntries = {
      ...plan,
      buildings: plan.buildings.map(building => ({
        ...building,
        foundation: { kind: 'stem-wall' as const, depthMeters: 1.2, heightAboveGroundMeters: 0.4 },
        entries: [createUtilityEntry({ system: 'water', outlineOffsetMeters: 4 })],
      })),
    };

    expect(parseSnapshot(serializeSitePlan(withEntries))).toEqual(withEntries);
  });

  it('round-trips utility routes and rejects one of an unknown system', () => {
    const plan = createRichSitePlan();
    const withRoutes: SitePlan = {
      ...plan,
      utilityRoutes: [
        createUtilityRoute({
          system: 'sewer',
          points: [
            { x: 1, y: 1 },
            { x: 9, y: 1 },
          ],
        }),
      ],
    };

    expect(parseSnapshot(serializeSitePlan(withRoutes))).toEqual(withRoutes);
    expect(
      parseSnapshot(
        serializeWith({
          ...withRoutes,
          utilityRoutes: [
            { ...createUtilityRoute({ system: 'water', points: [] }), system: 'lava' },
          ],
        })
      )
    ).toBeUndefined();
  });

  it('reads a plan saved before routes and the frost setting existed', () => {
    const plan = createRichSitePlan();
    const { utilityRoutes, ...withoutRoutes } = plan;
    const { frostDepthMeters, ...legacySettings } = plan.settings;
    const legacy = { ...withoutRoutes, settings: legacySettings };

    const parsed = parseSnapshot(serializeWith(legacy));

    expect(parsed).toBeDefined();
    expect(utilityRoutesOf(parsed ?? plan)).toEqual([]);
    expect(frostDepthOf((parsed ?? plan).settings)).toBeCloseTo(1.5);
  });

  it('rejects a foundation of an unknown kind and an entry of a non-entering system', () => {
    const plan = createRichSitePlan();

    expect(
      parseSnapshot(
        serializeWith({
          ...plan,
          buildings: plan.buildings.map(building => ({
            ...building,
            foundation: { kind: 'floating', depthMeters: 1, heightAboveGroundMeters: 0.3 },
          })),
        })
      )
    ).toBeUndefined();
    expect(
      parseSnapshot(
        serializeWith({
          ...plan,
          buildings: plan.buildings.map(building => ({
            ...building,
            entries: [
              {
                ...createUtilityEntry({ system: 'water', outlineOffsetMeters: 0 }),
                system: 'lava',
              },
            ],
          })),
        })
      )
    ).toBeUndefined();
  });

  it('round-trips a building whose storeys have been materialized', () => {
    const plan = createRichSitePlan();
    const withStoreys = {
      ...plan,
      buildings: plan.buildings.map(building => ({
        ...building,
        storeys: [
          createStorey({
            heightMeters: 2.7,
            walls: [
              createWall({
                points: [
                  { x: 0, y: 0 },
                  { x: 5, y: 0 },
                ],
              }),
            ],
            roofZoneLabels: [createRoofZoneLabel({ position: { x: 2, y: 2 }, cover: 'green' })],
          }),
          createStorey({ heightMeters: 2.7 }),
        ],
      })),
    };

    expect(parseSnapshot(serializeSitePlan(withStoreys))).toEqual(withStoreys);
  });

  it('stamps the current version into the payload', () => {
    const parsed: unknown = JSON.parse(serializeSitePlan(createDefaultSitePlan()));

    expect(parsed).toMatchObject({ version: CURRENT_SNAPSHOT_VERSION });
  });

  it('rejects malformed JSON', () => {
    expect(parseSnapshot('{ not json')).toBeUndefined();
    expect(parseSnapshot('')).toBeUndefined();
  });

  it('rejects a payload that is not an object', () => {
    expect(parseSnapshot('42')).toBeUndefined();
    expect(parseSnapshot('null')).toBeUndefined();
    expect(parseSnapshot('[]')).toBeUndefined();
  });

  it('rejects an unknown snapshot version', () => {
    const plan = createDefaultSitePlan();

    expect(parseSnapshot(serializeWith(plan, CURRENT_SNAPSHOT_VERSION + 1))).toBeUndefined();
    expect(parseSnapshot(JSON.stringify({ plan }))).toBeUndefined();
  });

  it('rejects a plan with a missing section', () => {
    const { settings, ...planWithoutSettings } = createDefaultSitePlan();

    expect(settings).toBeDefined();
    expect(parseSnapshot(serializeWith(planWithoutSettings))).toBeUndefined();
  });

  it('rejects a plan whose fields have the wrong type', () => {
    const plan = createDefaultSitePlan();

    expect(parseSnapshot(serializeWith({ ...plan, trees: 'none' }))).toBeUndefined();
    expect(
      parseSnapshot(serializeWith({ ...plan, cars: [{ id: '', position: { x: 1, y: 2 } }] }))
    ).toBeUndefined();
    expect(
      parseSnapshot(
        serializeWith({
          ...plan,
          cars: [{ id: 'a', position: { x: 1, y: 2 }, rotationDegrees: 'sideways' }],
        })
      )
    ).toBeUndefined();
    expect(
      parseSnapshot(serializeWith({ ...plan, elevationMarks: [{ id: '', elevation: 1 }] }))
    ).toBeUndefined();
    expect(
      parseSnapshot(
        serializeWith({
          ...plan,
          settings: {
            ...plan.settings,
            location: { ...plan.settings.location, latitudeDegrees: 120 },
          },
        })
      )
    ).toBeUndefined();
  });

  it('rejects a time zone the runtime cannot resolve', () => {
    const plan = createDefaultSitePlan();

    expect(
      parseSnapshot(
        serializeWith({
          ...plan,
          settings: {
            ...plan.settings,
            location: { ...plan.settings.location, timeZoneId: 'Not/AZone' },
          },
        })
      )
    ).toBeUndefined();
  });

  it('rejects a shape with a non-positive size', () => {
    const plan = createDefaultSitePlan();
    const brokenBoundary = {
      terms: [
        {
          operand: { ...plan.boundary.terms[0].operand, width: 0 },
          operation: 'union',
        },
      ],
    };

    expect(parseSnapshot(serializeWith({ ...plan, boundary: brokenBoundary }))).toBeUndefined();
  });

  it('round-trips a group of groups', () => {
    const plan = createRichSitePlan();
    const parsed = parseSnapshot(serializeSitePlan(plan));

    expect(parsed?.boundary).toEqual(plan.boundary);
  });

  it('rejects a group whose members are not terms', () => {
    const plan = createDefaultSitePlan();
    const brokenGroup = {
      terms: [
        {
          operand: { kind: 'group', id: createShapeId(), terms: [{ operand: 42 }] },
          operation: 'union',
        },
      ],
    };

    expect(parseSnapshot(serializeWith({ ...plan, boundary: brokenGroup }))).toBeUndefined();
  });

  it('rejects a group nested past the depth ceiling', () => {
    const plan = createDefaultSitePlan();

    expect(
      parseSnapshot(serializeWith({ ...plan, boundary: { terms: [nestGroups(17)] } }))
    ).toBeUndefined();
    expect(
      parseSnapshot(serializeWith({ ...plan, boundary: { terms: [nestGroups(16)] } }))
    ).toBeDefined();
  });

  /**
   * Version 1 of the format, written by a build in which a term could only hold
   * a primitive and named it `shape`. Kept as a literal rather than generated,
   * so the compatibility this asserts cannot drift with the current model.
   */
  it('reads a plan written before terms could hold groups', () => {
    const plan = parseSnapshot(LEGACY_FLAT_TERM_SNAPSHOT);

    expect(plan?.boundary.terms).toHaveLength(2);
    expect(plan?.boundary.terms[0]).toEqual({
      operand: {
        kind: 'rectangle',
        id: 'e2f8a0a4-0000-4000-8000-000000000001',
        center: { x: 15, y: 20 },
        width: 30,
        length: 40,
        rotationDegrees: 0,
      },
      operation: 'union',
    });
    expect(plan?.boundary.terms[1]).toEqual({
      operand: {
        kind: 'circle',
        id: 'e2f8a0a4-0000-4000-8000-000000000002',
        center: { x: 5, y: 5 },
        radius: 3,
      },
      operation: 'subtract',
    });
    expect(plan?.buildings[0]?.composition.terms[0].operand).toMatchObject({ kind: 'rectangle' });
    expect(plan?.buildings[0]?.wallHeight).toBe(3);
    // The single legacy house arrives as the only named building.
    expect(plan?.buildings).toHaveLength(1);
    expect(plan?.buildings[0]?.name).toBe('Дом');
    expect(plan?.trees).toHaveLength(1);
    expect(plan?.settings.gridStepMeters).toBe(0.5);
    // The chain runs through version 2 as well, so the oldest document also
    // arrives with a species and an empty car park.
    expect(plan?.trees[0].species).toBe('spruce');
    expect(plan?.cars).toEqual([]);
  });

  /**
   * Version 2, written by a build whose trees knew families rather than species
   * and which had no cars at all. Kept as a literal for the same reason version
   * 1 is: the compatibility it asserts must not drift with the current model.
   */
  it('reads a plan written before the catalogue', () => {
    const plan = parseSnapshot(LEGACY_PRE_CATALOG_SNAPSHOT);

    expect(plan?.trees.map(tree => tree.species)).toEqual(['spruce', 'deciduous']);
    expect(plan?.trees[0].crownRadius).toBe(2.5);
    expect(plan?.cars).toEqual([]);
    expect(plan?.boundary.terms).toHaveLength(1);
  });

  it('refuses a version 1 payload that was not a plan to begin with', () => {
    expect(parseSnapshot(JSON.stringify({ version: 1, plan: 'nothing' }))).toBeUndefined();
  });

  it('keeps a shape anchor through the round trip and accepts its absence', () => {
    const plan = createRichSitePlan();
    const [first, ...rest] = plan.boundary.terms;
    const anchored = {
      ...plan,
      boundary: {
        terms: [
          { ...first, operand: { ...first.operand, anchorFactors: { x: 0.5, y: -0.5 } } },
          ...rest,
        ],
      },
    };

    const restored = parseSnapshot(serializeSitePlan(anchored as SitePlan));

    expect(restored?.boundary.terms[0]?.operand).toMatchObject({
      anchorFactors: { x: 0.5, y: -0.5 },
    });
  });

  it('rejects an anchor that is not a point', () => {
    const plan = createRichSitePlan();
    const [first, ...rest] = plan.boundary.terms;
    const broken = {
      ...plan,
      boundary: {
        terms: [{ ...first, operand: { ...first.operand, anchorFactors: 'corner' } }, ...rest],
      },
    };

    expect(parseSnapshot(serializeWith(broken))).toBeUndefined();
  });

  it('keeps the paving of a path point and rejects an unknown one', () => {
    const plan = createRichSitePlan();
    const paved = {
      ...plan,
      paths: [
        {
          ...plan.paths[0],
          points: plan.paths[0].points.map(point => ({ ...point, surface: 'dirt' as const })),
        },
      ],
    };

    expect(parseSnapshot(serializeSitePlan(paved))?.paths[0]?.points[0]?.surface).toBe('dirt');

    const broken = {
      ...plan,
      paths: [
        {
          ...plan.paths[0],
          points: plan.paths[0].points.map(point => ({ ...point, surface: 'lava' })),
        },
      ],
    };

    expect(parseSnapshot(serializeWith(broken))).toBeUndefined();
  });

  it('rejects a building with an unknown pad elevation mode', () => {
    const plan = createRichSitePlan();
    const brokenBuilding = { ...plan.buildings[0], padElevationMode: 'sea-level' };

    expect(parseSnapshot(serializeWith({ ...plan, buildings: [brokenBuilding] }))).toBeUndefined();
  });

  it('accepts a plan without buildings', () => {
    const plan = createDefaultSitePlan();

    expect(parseSnapshot(serializeSitePlan(plan))?.buildings).toEqual([]);
  });

  it('accepts a payload saved while the removed underlay feature still existed', () => {
    const plan = createRichSitePlan();
    const legacyPayload = {
      ...plan,
      underlay: {
        imageDataUrl: 'data:image/png;base64,AAAA',
        anchorMeters: { x: 0, y: 40 },
        metersPerPixel: 0.05,
        opacity: 0.6,
        isVisible: true,
      },
    };

    expect(parseSnapshot(serializeWith(legacyPayload))).toBeDefined();
  });
});

describe('stairs and posts in the snapshot', () => {
  const planWithStorey = (storeyFields: Record<string, unknown>) => {
    const plan = createRichSitePlan();
    const [building] = plan.buildings;

    return {
      ...plan,
      buildings: [
        {
          ...building,
          storeys: [
            {
              id: 'storey-1',
              heightMeters: 2.7,
              walls: [],
              openings: [],
              roomLabels: [],
              roofZoneLabels: [],
              ...storeyFields,
            },
          ],
        },
      ],
    };
  };

  it('round-trips a stair with its hand and turn', () => {
    const stair = {
      id: 'stair-1',
      kind: 'l-shaped',
      position: { x: 3, y: 4 },
      rotationDegrees: 90,
      widthMeters: 1,
      isMirrored: true,
    };
    const parsed = parseSnapshot(serializeWith(planWithStorey({ stairs: [stair] })));

    expect(parsed?.buildings[0]?.storeys?.[0]?.stairs).toEqual([stair]);
  });

  it('round-trips a support post', () => {
    const post = { id: 'post-1', position: { x: 1, y: 2 }, profile: 'round', sizeMeters: 0.15 };
    const parsed = parseSnapshot(serializeWith(planWithStorey({ supports: [post] })));

    expect(parsed?.buildings[0]?.storeys?.[0]?.supports).toEqual([post]);
  });

  it('accepts a storey saved before stairs and posts existed', () => {
    const parsed = parseSnapshot(serializeWith(planWithStorey({})));

    expect(parsed?.buildings[0]?.storeys?.[0]?.stairs).toBeUndefined();
    expect(parsed?.buildings[0]?.storeys?.[0]?.supports).toBeUndefined();
  });

  it('refuses a stair of an unknown kind rather than loading it broken', () => {
    const parsed = parseSnapshot(
      serializeWith(
        planWithStorey({
          stairs: [
            {
              id: 'stair-1',
              kind: 'escalator',
              position: { x: 0, y: 0 },
              rotationDegrees: 0,
              widthMeters: 1,
            },
          ],
        })
      )
    );

    expect(parsed).toBeUndefined();
  });
});
