import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BallisticsEnvironment, TrajectoryResult } from './ballistics';
import {
  clampAim,
  createEnvironment,
  getLaunchVelocity,
  getMaxPower,
  hasCrossedApex,
  isPerShotWallMode,
  resolveWallMode,
  rollWind,
  simulateTrajectory,
  stepProjectile,
  traceTerrainImpact,
} from './ballistics';
import {
  AIM_SOLVER_PREFERRED_ELEVATION_DEGREES,
  BORDERS_EXTEND_MARGIN_WU,
  CALIBRATION_SPAN_TOLERANCE_WU,
  CALIBRATION_TARGET_SPAN_WU,
  DEFAULT_PHYSICS_OPTIONS,
  MAX_POWER,
  PADDED_WALL_RESTITUTION,
  POWER_TO_SPEED_WU_PER_TICK,
  PROJECTILE_TUNNEL_DEPTH_WU,
  RESOLVABLE_WALL_MODES,
  SPRING_WALL_RESTITUTION,
  TICKS_PER_SECOND,
} from './constants';
import { createFlatHeightfield } from './terrain/heightfield';
import type { ProjectileState, ResolvedWallMode } from './types';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 80;
const GROUND_HEIGHT_WU = 20;
const COLUMN_COUNT = FIELD_WIDTH;

function createTestEnvironment(
  wallMode: ResolvedWallMode,
  overrides: Partial<BallisticsEnvironment> = {}
): BallisticsEnvironment {
  return {
    ...createEnvironment(
      { ...DEFAULT_PHYSICS_OPTIONS, gravity: 0, isBordersExtendEnabled: false },
      0,
      wallMode,
      FIELD_WIDTH,
      FIELD_HEIGHT
    ),
    ...overrides,
  };
}

function createState(position: { x: number; y: number }, velocity: { x: number; y: number }) {
  return { position, velocity } satisfies ProjectileState;
}

beforeEach(() => {
  randomMock.mockReset();
  randomMock.mockReturnValue(0);
});

describe('getMaxPower', () => {
  it('caps firepower at ten times the remaining health', () => {
    expect(getMaxPower(100)).toBe(MAX_POWER);
    expect(getMaxPower(40)).toBe(400);
    expect(getMaxPower(0)).toBe(0);
  });

  it('clamps an aim that asks for more power than the damage allows', () => {
    const aim = clampAim({ facing: 'right', elevationDegrees: 120, power: 900 }, 40);

    expect(aim.power).toBe(400);
    expect(aim.elevationDegrees).toBe(90);
  });
});

describe('getLaunchVelocity', () => {
  it('sends a right-facing 0° shot straight along the ground', () => {
    const velocity = getLaunchVelocity({ facing: 'right', elevationDegrees: 0, power: 1000 });

    expect(velocity.x).toBeCloseTo(MAX_POWER * POWER_TO_SPEED_WU_PER_TICK);
    expect(velocity.y).toBeCloseTo(0);
  });

  it('mirrors the horizontal component for a left-facing turret', () => {
    const right = getLaunchVelocity({ facing: 'right', elevationDegrees: 30, power: 500 });
    const left = getLaunchVelocity({ facing: 'left', elevationDegrees: 30, power: 500 });

    expect(left.x).toBeCloseTo(-right.x);
    expect(left.y).toBeCloseTo(right.y);
  });
});

describe('stepProjectile', () => {
  it('pulls the shell down by the gravity acceleration each tick', () => {
    const environment = createTestEnvironment('none', { gravityWuPerTickSquared: 0.5 });
    const result = stepProjectile(createState({ x: 50, y: 50 }, { x: 0, y: 0 }), environment);

    expect(result.state.velocity.y).toBeCloseTo(-0.5);
    expect(result.state.position.y).toBeCloseTo(49.5);
  });

  it('pushes the shell sideways by the wind acceleration each tick', () => {
    const environment = createTestEnvironment('none', { windAccelerationWuPerTickSquared: 0.25 });
    const result = stepProjectile(createState({ x: 50, y: 50 }, { x: 1, y: 0 }), environment);

    expect(result.state.velocity.x).toBeCloseTo(1.25);
  });

  it('damps the velocity in proportion to the viscosity', () => {
    const environment = createTestEnvironment('none', { viscosity: 10 });
    const result = stepProjectile(createState({ x: 50, y: 50 }, { x: 2, y: 0 }), environment);

    expect(result.state.velocity.x).toBeCloseTo(2 * 0.99);
  });

  it('leaves the velocity untouched when the viscosity is off', () => {
    const environment = createTestEnvironment('none');
    const result = stepProjectile(createState({ x: 50, y: 50 }, { x: 2, y: 0 }), environment);

    expect(result.state.velocity.x).toBeCloseTo(2);
  });
});

describe('wall modes', () => {
  it('NONE lets the shot leave and scores it a miss at the field edge', () => {
    const environment = createTestEnvironment('none');
    const result = stepProjectile(createState({ x: 99, y: 50 }, { x: 5, y: 0 }), environment);

    expect(result.outcome).toBe('lost');
    expect(result.bounceSide).toBeUndefined();
  });

  it('NONE keeps tracking inside the Borders Extend margin', () => {
    const environment = createTestEnvironment('none', { isBordersExtendEnabled: true });
    const inside = stepProjectile(createState({ x: 99, y: 50 }, { x: 5, y: 0 }), environment);
    const beyond = stepProjectile(
      createState({ x: FIELD_WIDTH + BORDERS_EXTEND_MARGIN_WU - 1, y: 50 }, { x: 5, y: 0 }),
      environment
    );

    expect(inside.outcome).toBe('flying');
    expect(beyond.outcome).toBe('lost');
  });

  it('NONE scores a miss above the ceiling margin too', () => {
    const environment = createTestEnvironment('none');
    const result = stepProjectile(createState({ x: 50, y: 79 }, { x: 0, y: 5 }), environment);

    expect(result.outcome).toBe('lost');
  });

  it('CONCRETE swallows the shot at the wall it touched', () => {
    const environment = createTestEnvironment('concrete');
    const result = stepProjectile(createState({ x: 99, y: 50 }, { x: 5, y: 0 }), environment);

    expect(result.outcome).toBe('absorbed');
    expect(result.state.position.x).toBe(FIELD_WIDTH);
  });

  it('CONCRETE swallows the shot on the ceiling as well', () => {
    const environment = createTestEnvironment('concrete');
    const result = stepProjectile(createState({ x: 50, y: 79 }, { x: 0, y: 5 }), environment);

    expect(result.outcome).toBe('absorbed');
    expect(result.state.position.y).toBe(FIELD_HEIGHT);
  });

  it('PADDED bounces back with part of the energy gone', () => {
    const environment = createTestEnvironment('padded');
    const result = stepProjectile(createState({ x: 99, y: 50 }, { x: 5, y: 0 }), environment);

    expect(result.bounceSide).toBe('right');
    expect(result.state.velocity.x).toBeCloseTo(-5 * PADDED_WALL_RESTITUTION);
    expect(result.state.position.x).toBeCloseTo(96);
  });

  it('RUBBER bounces back with the full energy', () => {
    const environment = createTestEnvironment('rubber');
    const result = stepProjectile(createState({ x: 1, y: 50 }, { x: -5, y: 0 }), environment);

    expect(result.bounceSide).toBe('left');
    expect(result.state.velocity.x).toBeCloseTo(5);
    expect(result.state.position.x).toBeCloseTo(4);
  });

  it('SPRING bounces back faster than it arrived', () => {
    const environment = createTestEnvironment('spring');
    const result = stepProjectile(createState({ x: 99, y: 50 }, { x: 5, y: 0 }), environment);

    expect(result.state.velocity.x).toBeCloseTo(-5 * SPRING_WALL_RESTITUTION);
  });

  it('bouncy walls bounce the ceiling with the same restitution', () => {
    const environment = createTestEnvironment('rubber');
    const result = stepProjectile(createState({ x: 50, y: 79 }, { x: 0, y: 5 }), environment);

    expect(result.bounceSide).toBe('top');
    expect(result.state.velocity.y).toBeCloseTo(-5);
    expect(result.state.position.y).toBeCloseTo(76);
  });

  it('WRAP carries the shot across to the opposite edge', () => {
    const environment = createTestEnvironment('wrap');
    const rightward = stepProjectile(createState({ x: 99, y: 50 }, { x: 5, y: 0 }), environment);
    const leftward = stepProjectile(createState({ x: 1, y: 50 }, { x: -5, y: 0 }), environment);

    expect(rightward.outcome).toBe('flying');
    expect(rightward.state.position.x).toBeCloseTo(4);
    expect(leftward.state.position.x).toBeCloseTo(96);
    expect(rightward.state.velocity.x).toBeCloseTo(5);
  });

  it('WRAP still scores a miss above the ceiling', () => {
    const environment = createTestEnvironment('wrap');
    const result = stepProjectile(createState({ x: 50, y: 79 }, { x: 0, y: 5 }), environment);

    expect(result.outcome).toBe('lost');
  });

  it('every mode loses a shot that drops below the field floor', () => {
    for (const wallMode of RESOLVABLE_WALL_MODES) {
      const environment = createTestEnvironment(wallMode as ResolvedWallMode);
      const result = stepProjectile(createState({ x: 50, y: 1 }, { x: 0, y: -5 }), environment);

      expect(result.outcome).toBe('lost');
    }
  });
});

describe('resolveWallMode', () => {
  it('passes a concrete setting through untouched', () => {
    expect(resolveWallMode('rubber')).toBe('rubber');
    expect(randomMock).not.toHaveBeenCalled();
  });

  it('draws a concrete mode for RANDOM and ERRATIC', () => {
    randomMock.mockReturnValue(3);

    expect(resolveWallMode('random')).toBe(RESOLVABLE_WALL_MODES[3]);
    expect(resolveWallMode('erratic')).toBe(RESOLVABLE_WALL_MODES[3]);
  });

  it('knows that only ERRATIC re-rolls per shot', () => {
    expect(isPerShotWallMode('erratic')).toBe(true);
    expect(isPerShotWallMode('random')).toBe(false);
  });
});

describe('rollWind', () => {
  it('draws within the configured magnitude', () => {
    randomMock.mockReturnValue(-120);

    expect(rollWind(200)).toBe(-120);
    expect(randomMock).toHaveBeenCalledWith(-200, 200);
  });
});

describe('hasCrossedApex', () => {
  it('fires once, on the tick the climb turns into a fall', () => {
    expect(hasCrossedApex(0.4, -0.1)).toBe(true);
    expect(hasCrossedApex(0.4, 0.2)).toBe(false);
    expect(hasCrossedApex(-0.1, -0.4)).toBe(false);
  });
});

describe('traceTerrainImpact', () => {
  const field = createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT);

  it('detonates on the surface when a Contact Trigger is fitted', () => {
    const impact = traceTerrainImpact(
      field,
      { x: 50, y: GROUND_HEIGHT_WU + 5 },
      { x: 50, y: GROUND_HEIGHT_WU - 5 },
      { isTunnelingEnabled: true, hasContactTrigger: true }
    );

    expect(impact?.y).toBeCloseTo(GROUND_HEIGHT_WU - 1, 0);
  });

  it('burrows the tunnelling depth before detonating', () => {
    const contact = traceTerrainImpact(
      field,
      { x: 50, y: GROUND_HEIGHT_WU + 5 },
      { x: 50, y: GROUND_HEIGHT_WU - 5 },
      { isTunnelingEnabled: true, hasContactTrigger: false }
    );

    expect(contact?.y).toBeLessThan(GROUND_HEIGHT_WU - PROJECTILE_TUNNEL_DEPTH_WU + 1);
  });

  it('stops at the surface when tunnelling is switched off', () => {
    const contact = traceTerrainImpact(
      field,
      { x: 50, y: GROUND_HEIGHT_WU + 5 },
      { x: 50, y: GROUND_HEIGHT_WU - 5 },
      { isTunnelingEnabled: false, hasContactTrigger: false }
    );

    expect(contact?.y).toBeCloseTo(GROUND_HEIGHT_WU - 1, 0);
  });

  it('reports no impact for a segment that stays in the air', () => {
    const impact = traceTerrainImpact(
      field,
      { x: 10, y: 60 },
      { x: 30, y: 55 },
      { isTunnelingEnabled: true, hasContactTrigger: false }
    );

    expect(impact).toBeUndefined();
  });

  it('detonates on the bedrock floor instead of falling through an emptied column', () => {
    const emptied = createFlatHeightfield(0, COLUMN_COUNT);
    const impact = traceTerrainImpact(
      emptied,
      { x: 50, y: 5 },
      { x: 50, y: -5 },
      { isTunnelingEnabled: true, hasContactTrigger: false }
    );

    expect(impact).toEqual({ x: 50, y: 0 });
  });

  it('reports no floor impact for a shell already outside the field', () => {
    const emptied = createFlatHeightfield(0, COLUMN_COUNT);
    const impact = traceTerrainImpact(
      emptied,
      { x: -20, y: 5 },
      { x: -20, y: -5 },
      { isTunnelingEnabled: true, hasContactTrigger: false }
    );

    expect(impact).toBeUndefined();
  });
});

describe('simulateTrajectory', () => {
  it('lands a lobbed shot on the ground', () => {
    const field = createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT);
    const environment = createTestEnvironment('none', { gravityWuPerTickSquared: 0.08 });
    const result = simulateTrajectory(
      { x: 10, y: GROUND_HEIGHT_WU + 5 },
      { x: 0.5, y: 2 },
      environment,
      field
    );

    expect(result.outcome).toBe('impact');
    expect(result.impact?.x).toBeGreaterThan(10);
    expect(result.path.length).toBe(result.tickCount + 1);
  });

  it('reports the miss when the shot leaves the field', () => {
    const environment = createTestEnvironment('none', { gravityWuPerTickSquared: 0 });
    const result = simulateTrajectory({ x: 10, y: 50 }, { x: 5, y: 0 }, environment, undefined);

    expect(result.outcome).toBe('lost');
  });

  it('stops on a concrete wall', () => {
    const environment = createTestEnvironment('concrete', { gravityWuPerTickSquared: 0 });
    const result = simulateTrajectory({ x: 10, y: 50 }, { x: 5, y: 0 }, environment, undefined);

    expect(result.outcome).toBe('absorbed');
  });

  it('gives up after the tick budget', () => {
    const environment = createTestEnvironment('rubber', { gravityWuPerTickSquared: 0 });
    const result = simulateTrajectory({ x: 10, y: 50 }, { x: 5, y: 0 }, environment, undefined, 20);

    expect(result.outcome).toBe('expired');
    expect(result.tickCount).toBe(20);
  });
});

/**
 * §15.2, resolved at M4. The whole point of the power/gravity pair is that the dial spans the
 * field: these pin the calibration so a later tweak to either constant has to be deliberate.
 */
describe('power and gravity calibration', () => {
  const FULL_FIELD_ENVIRONMENT: BallisticsEnvironment = {
    ...createEnvironment(DEFAULT_PHYSICS_OPTIONS, 0, 'none'),
    isBordersExtendEnabled: false,
  };
  const LAUNCH_HEIGHT_WU = 0;
  const QUARTER = 0.25;
  const QUARTER_DECIMAL_PLACES = 2;
  /** Long enough that the wind visibly works on the shell rather than nudging it. */
  const MIN_FULL_POWER_FLIGHT_SECONDS = 2;

  function flyFullField(power: number): TrajectoryResult {
    return simulateTrajectory(
      { x: 0, y: LAUNCH_HEIGHT_WU },
      getLaunchVelocity({
        facing: 'right',
        elevationDegrees: AIM_SOLVER_PREFERRED_ELEVATION_DEGREES,
        power,
      }),
      FULL_FIELD_ENVIRONMENT,
      undefined
    );
  }

  function measureSpanWu(power: number): number {
    return Math.abs(flyFullField(power).path.at(-1)?.x ?? 0);
  }

  it('sends a full-power 45° shot the width of the field', () => {
    const span = measureSpanWu(MAX_POWER);

    expect(span).toBeGreaterThan(CALIBRATION_TARGET_SPAN_WU - CALIBRATION_SPAN_TOLERANCE_WU);
    expect(span).toBeLessThan(CALIBRATION_TARGET_SPAN_WU + CALIBRATION_SPAN_TOLERANCE_WU);
  });

  it('puts half the dial a quarter of the way across, so the throttle reads as squared', () => {
    expect(measureSpanWu(MAX_POWER / 2) / measureSpanWu(MAX_POWER)).toBeCloseTo(
      QUARTER,
      QUARTER_DECIMAL_PLACES
    );
  });

  it('leaves the shell in the air long enough for the wind to matter', () => {
    expect(flyFullField(MAX_POWER).tickCount / TICKS_PER_SECOND).toBeGreaterThan(
      MIN_FULL_POWER_FLIGHT_SECONDS
    );
  });
});
