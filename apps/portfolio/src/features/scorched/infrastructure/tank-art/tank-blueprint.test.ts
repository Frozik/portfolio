import { describe, expect, it, vi } from 'vitest';

import { getPlayerColor } from '../../presentation/player-colors';
import { SHAPES_PER_TANK } from '../render-constants';
import type { ITankBlueprint, ITankPose } from './tank-blueprint';
import { buildTankShapes } from './tank-blueprint';
import { createTankBlueprint } from './tank-generator';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn(actual.random) };
});

const BLUEPRINT: ITankBlueprint = {
  hullLengthWu: 14,
  hullHeightWu: 4,
  trackHeightWu: 3,
  wheelCount: 6,
  turretStyle: 'angular',
  turretWidthWu: 8,
  turretHeightWu: 3,
  gunLengthWu: 12,
  gunThicknessWu: 2,
  hasMuzzleBrake: true,
  hasAntenna: true,
};

function createPose(overrides: Partial<ITankPose> = {}): ITankPose {
  return {
    centerXWu: 100,
    baseYWu: 40,
    aim: { facing: 'right', elevationDegrees: 0 },
    color: getPlayerColor(0),
    ...overrides,
  };
}

describe('buildTankShapes', () => {
  it('stays inside the per-tank instance budget with every option on', () => {
    const shapes = buildTankShapes(BLUEPRINT, createPose());
    const RESERVED_FOR_BARS_AND_SHIELD = 3;

    expect(shapes.length).toBeLessThanOrEqual(SHAPES_PER_TANK - RESERVED_FOR_BARS_AND_SHIELD);
  });

  it('tilts the gun with the aim', () => {
    const level = buildTankShapes(BLUEPRINT, createPose());
    const raised = buildTankShapes(
      BLUEPRINT,
      createPose({ aim: { facing: 'right', elevationDegrees: 90 } })
    );
    const levelGun = level.find(shape => shape.rotationRadians !== undefined);
    const raisedGun = raised.find(shape => shape.rotationRadians !== undefined);

    expect(levelGun?.rotationRadians).toBeCloseTo(0);
    expect(raisedGun?.rotationRadians).toBeCloseTo(Math.PI / 2);
  });

  it('mirrors the turret when the aim faces left', () => {
    const rightShapes = buildTankShapes(
      BLUEPRINT,
      createPose({ aim: { facing: 'right', elevationDegrees: 0 } })
    );
    const leftShapes = buildTankShapes(
      BLUEPRINT,
      createPose({ aim: { facing: 'left', elevationDegrees: 0 } })
    );
    const rightGun = rightShapes.find(shape => shape.rotationRadians !== undefined);
    const leftGun = leftShapes.find(shape => shape.rotationRadians !== undefined);
    const pose = createPose();

    expect(rightGun && rightGun.centerXWu > pose.centerXWu).toBe(true);
    expect(leftGun && leftGun.centerXWu < pose.centerXWu).toBe(true);
  });
});

describe('createTankBlueprint', () => {
  it('rolls dimensions inside the cartoon ranges', () => {
    for (let roll = 0; roll < 50; roll++) {
      const blueprint = createTankBlueprint();

      expect(blueprint.hullLengthWu).toBeGreaterThanOrEqual(13);
      expect(blueprint.hullLengthWu).toBeLessThanOrEqual(16);
      expect(blueprint.wheelCount).toBeGreaterThanOrEqual(4);
      expect(blueprint.wheelCount).toBeLessThanOrEqual(6);
      expect(['angular', 'box', 'rounded']).toContain(blueprint.turretStyle);
      expect(blueprint.gunLengthWu).toBeGreaterThanOrEqual(11.5);
      expect(blueprint.gunLengthWu).toBeLessThanOrEqual(13);
    }
  });

  it('keeps every rolled blueprint inside the instance budget', () => {
    const RESERVED_FOR_BARS_AND_SHIELD = 3;

    for (let roll = 0; roll < 50; roll++) {
      const shapes = buildTankShapes(createTankBlueprint(), createPose());

      expect(shapes.length).toBeLessThanOrEqual(SHAPES_PER_TANK - RESERVED_FOR_BARS_AND_SHIELD);
    }
  });
});
