import { describe, expect, it } from 'vitest';

import {
  BATTERY_HEALTH_BONUS,
  FUEL_COST_PER_WU,
  MAG_DEFLECTOR_CAPACITY,
  MAG_DEFLECTOR_RADIUS_WU,
  MAX_TANK_HEALTH,
  SHIELD_CAPACITY_BY_TIER,
} from '../constants';
import { createFlatHeightfield, createHeightfield } from '../terrain/heightfield';
import { toPlayerId } from '../types';
import { getWeapon } from '../weapons/catalog';
import {
  absorbWithShield,
  applyBatteries,
  applyGuidance,
  applyMagDeflection,
  canFitGuidance,
  createMagDeflector,
  createShield,
  getGuidedWindAcceleration,
  isLaserBlockedBy,
  moveWithFuel,
  requiresTargetSelection,
  resolveShieldInteraction,
  selectAutoDefenseItem,
  shouldArmContactTrigger,
} from './behaviors';

const COLUMN_COUNT = 60;
const GROUND_HEIGHT_WU = 100;
const OWNER_ID = toPlayerId(1);
/** The peak damage of a heavy warhead — what a force-tier deflection now costs the bubble. */
const DEFLECTED_BLAST_DAMAGE = 120;

describe('shields', () => {
  it('builds each tier with its own capacity', () => {
    expect(createShield('shield')?.remaining).toBe(SHIELD_CAPACITY_BY_TIER.shield);
    expect(createShield('force-shield')?.tier).toBe('force');
    expect(createShield('heavy-shield')?.remaining).toBe(SHIELD_CAPACITY_BY_TIER.heavy);
    expect(createShield('fuel')).toBeUndefined();
  });

  it('gives only the Super Mag laser immunity', () => {
    expect(isLaserBlockedBy(createShield('super-mag'))).toBe(true);
    expect(isLaserBlockedBy(createShield('heavy-shield'))).toBe(false);
    expect(isLaserBlockedBy(undefined)).toBe(false);
  });

  it('soaks damage until the bubble is spent, then lets the rest through', () => {
    const shield = createShield('shield');
    const partial = absorbWithShield(shield, 30);

    expect(partial.absorbed).toBe(30);
    expect(partial.passedThrough).toBe(0);
    expect(partial.shield?.remaining).toBe(SHIELD_CAPACITY_BY_TIER.shield - 30);

    const overflow = absorbWithShield(partial.shield, SHIELD_CAPACITY_BY_TIER.shield);

    expect(overflow.shield).toBeUndefined();
    expect(overflow.passedThrough).toBe(30);
  });

  it('gives the force tier a budget two deflected blasts can exhaust', () => {
    const first = absorbWithShield(createShield('force-shield'), DEFLECTED_BLAST_DAMAGE);
    const second = absorbWithShield(first.shield, DEFLECTED_BLAST_DAMAGE);

    expect(first.shield?.remaining).toBe(SHIELD_CAPACITY_BY_TIER.force - DEFLECTED_BLAST_DAMAGE);
    expect(second.shield).toBeUndefined();
  });

  it('passes damage straight through when there is no shield', () => {
    expect(absorbWithShield(undefined, 25)).toEqual({
      shield: undefined,
      absorbed: 0,
      passedThrough: 25,
    });
  });

  it('eats an enemy direct hit instead of letting it detonate on the tank', () => {
    expect(resolveShieldInteraction(createShield('shield'), false)).toBe('absorb-direct-hit');
    expect(resolveShieldInteraction(createShield('heavy-shield'), false)).toBe('absorb-direct-hit');
  });

  it('deflects an enemy direct hit at the force tier', () => {
    expect(resolveShieldInteraction(createShield('force-shield'), false)).toBe('deflect');
  });

  it('lets the owner shoot out through their own bubble', () => {
    expect(resolveShieldInteraction(createShield('force-shield'), true)).toBe('pass-through');
    expect(resolveShieldInteraction(undefined, false)).toBe('none');
  });

  it("still soaks the splash of the owner's own descending shell", () => {
    const shield = createShield('shield');
    const suicideBlast = SHIELD_CAPACITY_BY_TIER.shield + 40;

    expect(resolveShieldInteraction(shield, true)).toBe('pass-through');
    expect(absorbWithShield(shield, suicideBlast).passedThrough).toBe(40);
  });
});

describe('auto defense', () => {
  it('arms the strongest bubble the tank owns', () => {
    expect(selectAutoDefenseItem({ shield: 2, 'heavy-shield': 1 })).toBe('heavy-shield');
    expect(selectAutoDefenseItem({ shield: 2, 'super-mag': 1 })).toBe('super-mag');
    expect(selectAutoDefenseItem({ shield: 1 })).toBe('shield');
  });

  it('arms nothing when the locker is empty', () => {
    expect(selectAutoDefenseItem({ fuel: 3 })).toBeUndefined();
    expect(selectAutoDefenseItem({ shield: 0 })).toBeUndefined();
  });
});

describe('mag deflector', () => {
  it('pushes a passing shell upward and spends a unit of capacity', () => {
    const deflector = createMagDeflector('mag-deflector', OWNER_ID, { x: 100, y: 50 });
    const result = applyMagDeflection({ x: 110, y: 50 }, { x: 3, y: -2 }, [deflector]);

    expect(result.velocity.y).toBeGreaterThan(-2);
    expect(result.deflectors[0].remainingCapacity).toBe(MAG_DEFLECTOR_CAPACITY - 1);
  });

  it('ignores shells outside its radius', () => {
    const deflector = createMagDeflector('mag-deflector', OWNER_ID, { x: 100, y: 50 });
    const result = applyMagDeflection(
      { x: 100 + MAG_DEFLECTOR_RADIUS_WU + 1, y: 50 },
      { x: 3, y: -2 },
      [deflector]
    );

    expect(result.velocity.y).toBe(-2);
    expect(result.deflectors[0].remainingCapacity).toBe(MAG_DEFLECTOR_CAPACITY);
  });

  it('saturates once its budget is exhausted', () => {
    const spent = {
      ...createMagDeflector('mag-deflector', OWNER_ID, { x: 100, y: 50 }),
      remainingCapacity: 0,
    };
    const result = applyMagDeflection({ x: 100, y: 50 }, { x: 3, y: -2 }, [spent]);

    expect(result.velocity.y).toBe(-2);
  });

  it('gives the Super Mag a stronger push than the plain deflector', () => {
    const plain = createMagDeflector('mag-deflector', OWNER_ID, { x: 100, y: 50 });
    const superMag = createMagDeflector('super-mag', OWNER_ID, { x: 100, y: 50 });

    expect(superMag.accelerationWuPerTickSquared).toBeGreaterThan(
      plain.accelerationWuPerTickSquared
    );
    expect(superMag.radiusWu).toBeGreaterThan(plain.radiusWu);
  });
});

describe('batteries', () => {
  it('restores ten health each', () => {
    expect(applyBatteries(70, 2)).toEqual({ health: 90, consumed: 2 });
  });

  it('never overshoots the cap and never wastes a spare', () => {
    expect(applyBatteries(95, 5)).toEqual({ health: MAX_TANK_HEALTH, consumed: 1 });
    expect(applyBatteries(MAX_TANK_HEALTH, 3)).toEqual({
      health: MAX_TANK_HEALTH,
      consumed: 0,
    });
  });

  it('uses everything it has when that is still not enough', () => {
    expect(applyBatteries(10, 2)).toEqual({ health: 10 + 2 * BATTERY_HEALTH_BONUS, consumed: 2 });
  });
});

describe('guidance', () => {
  it('refuses to fit onto MIRVs, riot charges and plasma', () => {
    expect(canFitGuidance(getWeapon('mirv'))).toBe(false);
    expect(canFitGuidance(getWeapon('deaths-head'))).toBe(false);
    expect(canFitGuidance(getWeapon('riot-charge'))).toBe(false);
    expect(canFitGuidance(getWeapon('riot-blast'))).toBe(false);
    expect(canFitGuidance(getWeapon('plasma-blast'))).toBe(false);
  });

  it('fits onto ordinary shells', () => {
    expect(canFitGuidance(getWeapon('nuke'))).toBe(true);
    expect(canFitGuidance(getWeapon('baby-missile'))).toBe(true);
  });

  it('only asks Lazy Boy for a target', () => {
    expect(requiresTargetSelection('lazy-boy')).toBe(true);
    expect(requiresTargetSelection('heat-guidance')).toBe(false);
  });

  it('cancels the wind for ballistic guidance and nothing else', () => {
    expect(getGuidedWindAcceleration('ballistic-guidance', 0.01)).toBe(0);
    expect(getGuidedWindAcceleration('heat-guidance', 0.01)).toBe(0.01);
    expect(getGuidedWindAcceleration(undefined, 0.01)).toBe(0.01);
  });

  it('bends a heat-seeking shell towards the target without changing its speed', () => {
    const velocity = applyGuidance(
      'heat-guidance',
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 100, y: 100 },
      false
    );

    expect(velocity.y).toBeGreaterThan(0);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(5);
  });

  it('leaves a ballistic-guided shell alone in flight', () => {
    const velocity = applyGuidance(
      'ballistic-guidance',
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 100, y: 100 },
      true
    );

    expect(velocity).toEqual({ x: 5, y: 1 });
  });

  it('does nothing without a target', () => {
    expect(applyGuidance('lazy-boy', { x: 0, y: 0 }, { x: 5, y: 1 }, undefined, true)).toEqual({
      x: 5,
      y: 1,
    });
  });

  it('lets a vertically-guided shell climb untouched', () => {
    const velocity = applyGuidance(
      'vertical-guidance',
      { x: 100, y: 50 },
      { x: 5, y: 4 },
      { x: 110, y: 10 },
      false
    );

    expect(velocity).toEqual({ x: 5, y: 4 });
  });

  it('dives a vertically-guided shell onto the tank it is descending over', () => {
    const velocity = applyGuidance(
      'vertical-guidance',
      { x: 100, y: 50 },
      { x: 5, y: -1 },
      { x: 110, y: 10 },
      true
    );

    expect(velocity.y).toBeLessThan(-1);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(Math.hypot(5, 1));
  });

  it('ignores a vertically-guided shell still far from being overhead', () => {
    const velocity = applyGuidance(
      'vertical-guidance',
      { x: 0, y: 50 },
      { x: 5, y: -1 },
      { x: 110, y: 10 },
      true
    );

    expect(velocity).toEqual({ x: 5, y: -1 });
  });

  it('flies a horizontally-guided shell in only at the target level', () => {
    const highAbove = applyGuidance(
      'horizontal-guidance',
      { x: 0, y: 200 },
      { x: 5, y: -1 },
      { x: 110, y: 10 },
      true
    );
    const atLevel = applyGuidance(
      'horizontal-guidance',
      { x: 0, y: 20 },
      { x: 5, y: -1 },
      { x: 110, y: 10 },
      true
    );

    expect(highAbove).toEqual({ x: 5, y: -1 });
    expect(atLevel.y).toBeGreaterThan(-1);
  });
});

describe('contact triggers', () => {
  it('arms only when selected and in stock', () => {
    expect(shouldArmContactTrigger(true, 25)).toBe(true);
    expect(shouldArmContactTrigger(true, 0)).toBe(false);
    expect(shouldArmContactTrigger(false, 25)).toBe(false);
  });
});

describe('fuel', () => {
  const flatField = createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT);

  it('buys one column of level travel per unit', () => {
    expect(moveWithFuel(flatField, 10, 1, 5)).toEqual({
      columnIndex: 15,
      fuelSpent: 5 * FUEL_COST_PER_WU,
      didSlide: false,
    });
  });

  it('drives to the left just as well', () => {
    expect(moveWithFuel(flatField, 10, -1, 3).columnIndex).toBe(7);
  });

  it('costs more going uphill', () => {
    const rampField = createHeightfield(
      Array.from({ length: COLUMN_COUNT }, (_unused, index) => GROUND_HEIGHT_WU + index)
    );
    const uphill = moveWithFuel(rampField, 10, 1, 5);

    expect(uphill.columnIndex).toBeLessThan(15);
    expect(uphill.fuelSpent).toBeLessThanOrEqual(5);
  });

  it('refuses a slope the tracks cannot hold', () => {
    const cliffField = createHeightfield(
      Array.from({ length: COLUMN_COUNT }, (_unused, index) =>
        index >= 12 ? GROUND_HEIGHT_WU + 50 : GROUND_HEIGHT_WU
      )
    );

    expect(moveWithFuel(cliffField, 10, 1, 20).columnIndex).toBe(11);
  });

  it('slides back down a slope that is too steep to stand on', () => {
    const ledgeField = createHeightfield(
      Array.from({ length: COLUMN_COUNT }, (_unused, index) =>
        index <= 12 ? GROUND_HEIGHT_WU : GROUND_HEIGHT_WU - 60
      )
    );
    const move = moveWithFuel(ledgeField, 10, 1, 2);

    expect(move.didSlide).toBe(true);
    expect(move.columnIndex).toBeGreaterThan(12);
  });

  it('stays put when the tank is not going anywhere', () => {
    expect(moveWithFuel(flatField, 10, 0, 5)).toEqual({
      columnIndex: 10,
      fuelSpent: 0,
      didSlide: false,
    });
  });
});
