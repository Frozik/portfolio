import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';

import type { BallisticsEnvironment } from '../ballistics';
import { createEnvironment } from '../ballistics';
import { DEFAULT_PHYSICS_OPTIONS, MAX_POWER, TOSSER_REFINEMENT_GAIN } from '../constants';
import type { Heightfield } from '../terrain/heightfield';
import { createFlatHeightfield, createHeightfield, isSolidAt } from '../terrain/heightfield';
import type { AimState, ResolvedWallMode } from '../types';
import {
  findBankShotAim,
  hasClearLineOfFire,
  isOnTarget,
  measureShot,
  refineAimForWind,
  refineFromMiss,
  solveNoDragAim,
  solveSpeedForElevation,
} from './aim-solver';

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;
const GROUND_HEIGHT_WU = 100;
const ORIGIN = { x: 100, y: GROUND_HEIGHT_WU };
const TARGET = { x: 500, y: GROUND_HEIGHT_WU };
const BASELINE_AIM: AimState = { facing: 'right', elevationDegrees: 45, power: 500 };

function createTestEnvironment(
  wallMode: ResolvedWallMode = 'none',
  windUnits = 0
): BallisticsEnvironment {
  return createEnvironment(DEFAULT_PHYSICS_OPTIONS, windUnits, wallMode, FIELD_WIDTH, FIELD_HEIGHT);
}

function createGround(): Heightfield {
  return createFlatHeightfield(GROUND_HEIGHT_WU, FIELD_WIDTH);
}

function expectHits(
  aim: AimState | undefined,
  origin: { x: number; y: number },
  target: { x: number; y: number },
  environment: BallisticsEnvironment
): void {
  assert(aim !== undefined, 'the solver found no aim at all');

  expect(isOnTarget(measureShot(origin, aim, environment, createGround(), target))).toBe(true);
}

describe('solveSpeedForElevation', () => {
  it('matches the textbook range formula for a level 45° shot', () => {
    const gravity = 0.08;
    const speed = solveSpeedForElevation({ x: 400, y: 0 }, 45, gravity);

    expect(speed).toBeCloseTo(Math.sqrt(400 * gravity));
  });

  it('needs more speed to reach further', () => {
    const near = solveSpeedForElevation({ x: 200, y: 0 }, 45, 0.08) ?? 0;
    const far = solveSpeedForElevation({ x: 600, y: 0 }, 45, 0.08) ?? 0;

    expect(far).toBeGreaterThan(near);
  });

  it('gives up on an elevation that cannot reach the target', () => {
    expect(solveSpeedForElevation({ x: 400, y: 200 }, 5, 0.08)).toBeUndefined();
    expect(solveSpeedForElevation({ x: 0, y: 100 }, 45, 0.08)).toBeUndefined();
    expect(solveSpeedForElevation({ x: 400, y: 0 }, 45, 0)).toBeUndefined();
  });
});

describe('solveNoDragAim', () => {
  it('finds a shot that lands on the target in still air', () => {
    const environment = createTestEnvironment();
    const aim = solveNoDragAim(ORIGIN, TARGET, environment.gravityWuPerTickSquared, MAX_POWER);

    expect(aim?.facing).toBe('right');
    expectHits(aim, ORIGIN, TARGET, environment);
  });

  it('turns the turret around for a target on the left', () => {
    const environment = createTestEnvironment();
    const aim = solveNoDragAim(
      ORIGIN,
      { x: 20, y: GROUND_HEIGHT_WU },
      environment.gravityWuPerTickSquared,
      MAX_POWER
    );

    expect(aim?.facing).toBe('left');
  });

  it('refuses a target the power ceiling cannot reach', () => {
    const environment = createTestEnvironment();

    expect(
      solveNoDragAim(ORIGIN, { x: 790, y: 400 }, environment.gravityWuPerTickSquared, 50)
    ).toBeUndefined();
  });
});

describe('measureShot', () => {
  it('reports a landing shot and its horizontal miss', () => {
    const environment = createTestEnvironment();
    const measurement = measureShot(ORIGIN, BASELINE_AIM, environment, createGround(), TARGET);

    expect(measurement.didLand).toBe(true);
    expect(isOnTarget(measurement)).toBe(false);
  });

  it('never counts a shot that a wall swallowed as a hit', () => {
    const environment = createTestEnvironment('concrete');
    const measurement = measureShot(
      { x: 700, y: GROUND_HEIGHT_WU },
      { facing: 'right', elevationDegrees: 45, power: 420 },
      environment,
      createGround(),
      { x: 760, y: GROUND_HEIGHT_WU }
    );

    expect(measurement.didLand).toBe(false);
    expect(isOnTarget(measurement)).toBe(false);
  });
});

describe('refineAimForWind', () => {
  it('lands on the target despite a strong crosswind', () => {
    const environment = createTestEnvironment('none', 200);

    expectHits(
      refineAimForWind(ORIGIN, TARGET, environment, createGround(), MAX_POWER),
      ORIGIN,
      TARGET,
      environment
    );
  });

  it('corrects into the wind rather than with it', () => {
    const field = createGround();
    const tailwind = refineAimForWind(
      ORIGIN,
      TARGET,
      createTestEnvironment('none', 200),
      field,
      MAX_POWER
    );
    const headwind = refineAimForWind(
      ORIGIN,
      TARGET,
      createTestEnvironment('none', -200),
      field,
      MAX_POWER
    );

    expect(tailwind?.power ?? 0).toBeLessThan(headwind?.power ?? 0);
  });

  it('reports no solution when the target is unreachable', () => {
    expect(
      refineAimForWind(ORIGIN, { x: 799, y: 480 }, createTestEnvironment(), createGround(), 20)
    ).toBeUndefined();
  });
});

describe('findBankShotAim', () => {
  const BANK_ORIGIN = { x: 700, y: GROUND_HEIGHT_WU };
  const BANK_TARGET = { x: 760, y: GROUND_HEIGHT_WU };

  it('banks off a rubber wall onto a nearby target', () => {
    const environment = createTestEnvironment('rubber');

    expectHits(
      findBankShotAim(BANK_ORIGIN, BANK_TARGET, environment, createGround(), MAX_POWER),
      BANK_ORIGIN,
      BANK_TARGET,
      environment
    );
  });

  it('finds nothing to bank off when the walls absorb everything', () => {
    expect(
      findBankShotAim(
        BANK_ORIGIN,
        BANK_TARGET,
        createTestEnvironment('concrete'),
        createGround(),
        MAX_POWER
      )
    ).toBeUndefined();
  });
});

describe('refineFromMiss', () => {
  it('adds power after falling short', () => {
    const aim = refineFromMiss(BASELINE_AIM, ORIGIN, { x: 300, y: 100 }, TARGET, MAX_POWER);

    expect(aim.power).toBeCloseTo(500 * (1 + TOSSER_REFINEMENT_GAIN * 0.5));
  });

  it('takes power off after overshooting', () => {
    const aim = refineFromMiss(BASELINE_AIM, ORIGIN, { x: 700, y: 100 }, TARGET, MAX_POWER);

    expect(aim.power).toBeLessThan(BASELINE_AIM.power);
  });

  it('never exceeds the health-capped power ceiling', () => {
    expect(refineFromMiss(BASELINE_AIM, ORIGIN, { x: 120, y: 100 }, TARGET, 400).power).toBe(400);
  });

  it('turns the turret towards the target', () => {
    expect(
      refineFromMiss(BASELINE_AIM, ORIGIN, { x: 300, y: 100 }, { x: 20, y: 100 }, MAX_POWER).facing
    ).toBe('left');
  });

  it('keeps the aim when the target sits on the muzzle', () => {
    expect(refineFromMiss(BASELINE_AIM, ORIGIN, { x: 300, y: 100 }, ORIGIN, MAX_POWER)).toEqual(
      BASELINE_AIM
    );
  });
});

describe('hasClearLineOfFire', () => {
  const field = createHeightfield(
    Array.from({ length: FIELD_WIDTH }, (_unused, index) =>
      index >= 280 && index < 320 ? 300 : GROUND_HEIGHT_WU
    )
  );
  const isSolidAtPoint = (position: { x: number; y: number }) =>
    isSolidAt(field, position.x, position.y);

  it('sees a target across open ground', () => {
    expect(
      hasClearLineOfFire(
        { x: 100, y: GROUND_HEIGHT_WU + 20 },
        { x: 200, y: GROUND_HEIGHT_WU + 20 },
        isSolidAtPoint
      )
    ).toBe(true);
  });

  it('is blocked by a hill in the way', () => {
    expect(
      hasClearLineOfFire(
        { x: 100, y: GROUND_HEIGHT_WU + 20 },
        { x: 500, y: GROUND_HEIGHT_WU + 20 },
        isSolidAtPoint
      )
    ).toBe(false);
  });
});
