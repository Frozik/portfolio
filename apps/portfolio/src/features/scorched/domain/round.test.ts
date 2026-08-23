import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLaunchOrigin } from './ballistics';
import {
  BATTERY_HEALTH_BONUS,
  DEFAULT_PHYSICS_OPTIONS,
  FUEL_COST_PER_WU,
  LIQUID_DIRT_POUR_PORTIONS,
  MAX_FLIGHT_TICKS,
  MAX_TANK_HEALTH,
  SHIELD_CAPACITY_BY_TIER,
  TANK_HALF_WIDTH_WU,
} from './constants';
import type { FireOptions, RoundOptions, RoundPlayerSetup } from './round';
import { ScorchedRound } from './round';
import { createFlatHeightfield, getSurfaceHeight } from './terrain/heightfield';
import type { PhysicsOptions, PlayerInventory, WorldEvent } from './types';
import { getWeapon } from './weapons/catalog';
import { getBlastPeakDamage } from './weapons/explosions';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const COLUMN_COUNT = 800;
const GROUND_HEIGHT_WU = 100;
const FIRST_COLUMN = 200;
const SECOND_COLUMN = 600;
const EMPTY_INVENTORY: PlayerInventory = { weapons: {}, items: {} };
const BABY_MISSILE_BLAST_RADIUS_WU = getWeapon('baby-missile').blastRadiusWu;

function createPlayer(
  id: number,
  columnIndex: number,
  overrides: Partial<RoundPlayerSetup> = {}
): RoundPlayerSetup {
  return {
    id,
    columnIndex,
    health: MAX_TANK_HEALTH,
    inventory: EMPTY_INVENTORY,
    ...overrides,
  };
}

function createRound(
  overrides: Partial<RoundOptions> = {},
  physicsOverrides: Partial<PhysicsOptions> = {}
): ScorchedRound {
  const round = new ScorchedRound({
    roundNumber: 1,
    players: [createPlayer(1, FIRST_COLUMN), createPlayer(2, SECOND_COLUMN)],
    field: createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT),
    physics: { ...DEFAULT_PHYSICS_OPTIONS, maxWind: 0, ...physicsOverrides },
    playOrder: 'sequential',
    ...overrides,
  });

  round.start();

  return round;
}

/** Flies the current shot to its conclusion and returns everything that happened. */
function runFlight(round: ScorchedRound): readonly WorldEvent[] {
  const events: WorldEvent[] = [];

  for (let tick = 0; tick < MAX_FLIGHT_TICKS + 2 && round.phase === 'flight'; tick++) {
    events.push(...round.tick());
  }

  return events;
}

function fireAndFly(round: ScorchedRound, fireOptions: FireOptions): readonly WorldEvent[] {
  return [...round.fire(fireOptions), ...runFlight(round)];
}

/** A direct hit on the second tank: solved for the flat 400 wu gap with the muzzle launch. */
function aimAtSecondTank(round: ScorchedRound): void {
  round.setAim({ facing: 'right', elevationDegrees: 45, power: 686.8 });
}

beforeEach(() => {
  randomMock.mockReset();
  randomMock.mockReturnValue(0);
});

describe('round setup', () => {
  it('opens with the round and the first turn', () => {
    const round = new ScorchedRound({
      roundNumber: 3,
      players: [createPlayer(1, FIRST_COLUMN), createPlayer(2, SECOND_COLUMN)],
      field: createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT),
      physics: { ...DEFAULT_PHYSICS_OPTIONS, maxWind: 0 },
      playOrder: 'sequential',
    });
    const events = round.start();

    expect(events[0]).toEqual({ type: 'round-started', roundNumber: 3, windUnits: 0 });
    expect(events[1]).toEqual({ type: 'turn-started', playerId: 1 });
    expect(round.phase).toBe('aiming');
  });

  it('stands every tank on the surface of its column', () => {
    const round = createRound();

    expect(round.tanks[0].positionY).toBe(GROUND_HEIGHT_WU);
    expect(round.tanks[1].columnIndex).toBe(SECOND_COLUMN);
  });

  it('ends immediately when only one tank turns up', () => {
    const round = new ScorchedRound({
      roundNumber: 1,
      players: [createPlayer(1, FIRST_COLUMN)],
      field: createFlatHeightfield(GROUND_HEIGHT_WU, COLUMN_COUNT),
      physics: DEFAULT_PHYSICS_OPTIONS,
      playOrder: 'sequential',
    });
    const events = round.start();

    expect(round.phase).toBe('ended');
    expect(events.at(-1)).toEqual({ type: 'round-ended', survivorIds: [1] });
  });
});

describe('aiming', () => {
  it('caps the power at ten times the damaged tank health', () => {
    const round = createRound({
      players: [createPlayer(1, FIRST_COLUMN, { health: 40 }), createPlayer(2, SECOND_COLUMN)],
    });

    round.setAim({ facing: 'right', elevationDegrees: 45, power: 1000 });

    expect(round.tanks[0].aim.power).toBe(400);
  });
});

describe('firing', () => {
  it('launches a shell and switches to the flight phase', () => {
    const round = createRound();

    aimAtSecondTank(round);

    const events = round.fire({ weaponId: 'baby-missile' });

    expect(round.phase).toBe('flight');
    expect(round.projectiles).toHaveLength(1);
    expect(events[0].type).toBe('projectile-launched');
  });

  it('never runs out of Baby Missiles', () => {
    const round = createRound();

    expect(round.fire({ weaponId: 'baby-missile' })).not.toEqual([]);
  });

  it('refuses to fire a weapon the tank does not own', () => {
    const round = createRound();

    expect(round.fire({ weaponId: 'nuke' })).toEqual([]);
    expect(round.phase).toBe('aiming');
  });

  it('spends a shell from the locker', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { nuke: 2 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    round.fire({ weaponId: 'nuke' });

    expect(round.getAmmoCount(1, 'nuke')).toBe(1);
  });
});

describe('flight and impact', () => {
  it('carves a crater and passes the turn on', () => {
    const round = createRound();

    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.some(event => event.type === 'explosion')).toBe(true);
    expect(events.some(event => event.type === 'terrain-carved')).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'turn-started', playerId: 2 });
    expect(round.phase).toBe('aiming');
  });

  it('hurts the tank it lands on', () => {
    const round = createRound();

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'baby-missile' });

    expect(round.tanks[1].health).toBeLessThan(MAX_TANK_HEALTH);
  });

  it('lowers the ground where it hit', () => {
    const round = createRound();

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'baby-missile' });

    expect(getSurfaceHeight(round.field, SECOND_COLUMN)).toBeLessThan(GROUND_HEIGHT_WU);
  });

  it('holds the turn until the carved ground has settled — nobody fires over falling sand', () => {
    const round = createRound();

    aimAtSecondTank(round);
    round.fire({ weaponId: 'baby-missile' });

    while (round.projectiles.length > 0) {
      round.tick();
    }

    expect(round.phase).toBe('flight');

    runFlight(round);

    expect(round.phase).toBe('aiming');
  });

  it('scores a miss when the shell leaves the field', () => {
    const round = createRound();

    round.setAim({ facing: 'left', elevationDegrees: 10, power: 1000 });

    const events = fireAndFly(round, { weaponId: 'baby-missile' });
    const ended = events.find(event => event.type === 'projectile-ended');

    expect(ended).toEqual(expect.objectContaining({ reason: 'out-of-bounds' }));
  });

  it('records the damage and the kill for the shooter', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { nuke: 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN, { health: 20 }),
      ],
    });

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'nuke' });

    expect(round.outcome.kills).toEqual([{ killerId: 1, victimId: 2 }]);
    expect(round.phase).toBe('ended');
  });
});

describe('contact triggers', () => {
  it('covers every warhead of the shot it armed', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, {
          inventory: { weapons: { mirv: 1 }, items: { 'contact-trigger': 25 } },
        }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    aimAtSecondTank(round);
    round.fire({ weaponId: 'mirv', useContactTrigger: true });

    for (let tick = 0; tick < MAX_FLIGHT_TICKS && round.projectiles.length <= 1; tick++) {
      round.tick();
    }

    expect(round.projectiles.length).toBeGreaterThan(1);
    expect(round.projectiles.every(projectile => projectile.hasContactTrigger)).toBe(true);
    expect(round.getItemCount(1, 'contact-trigger')).toBe(24);
  });

  it('cannot arm a trigger it does not own', () => {
    const round = createRound();

    aimAtSecondTank(round);
    round.fire({ weaponId: 'baby-missile', useContactTrigger: true });

    expect(round.projectiles[0].hasContactTrigger).toBe(false);
  });
});

describe('MIRV', () => {
  it('splits at apex into five warheads sharing one shot', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { mirv: 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    aimAtSecondTank(round);
    round.fire({ weaponId: 'mirv' });

    for (let tick = 0; tick < MAX_FLIGHT_TICKS && round.projectiles.length <= 1; tick++) {
      round.tick();
    }

    expect(round.projectiles).toHaveLength(5);
    expect(new Set(round.projectiles.map(projectile => projectile.shotId)).size).toBe(1);
  });
});

describe('shields', () => {
  it('eats an enemy direct hit instead of letting it detonate', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN),
        createPlayer(2, SECOND_COLUMN, { armedShieldItemId: 'heavy-shield' }),
      ],
    });

    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.some(event => event.type === 'shield-absorbed')).toBe(true);
    expect(round.tanks[1].health).toBe(MAX_TANK_HEALTH);
    expect(round.tanks[1].shield?.remaining).toBeLessThan(SHIELD_CAPACITY_BY_TIER.heavy);
  });

  it('deflects an enemy shell at the force tier', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN),
        createPlayer(2, SECOND_COLUMN, { armedShieldItemId: 'force-shield' }),
      ],
    });

    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.some(event => event.type === 'shield-deflected')).toBe(true);
    expect(round.tanks[1].health).toBe(MAX_TANK_HEALTH);
  });

  it('charges the force tier for every shell it turns around', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN),
        createPlayer(2, SECOND_COLUMN, { armedShieldItemId: 'force-shield' }),
      ],
    });

    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.some(event => event.type === 'shield-absorbed')).toBe(true);
    expect(round.tanks[1].shield?.remaining).toBe(
      SHIELD_CAPACITY_BY_TIER.force - getBlastPeakDamage(BABY_MISSILE_BLAST_RADIUS_WU)
    );
  });

  it('re-arms the next bubble the moment the first collapses, when Auto Defense is installed', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { nuke: 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN, {
          armedShieldItemId: 'shield',
          inventory: { weapons: {}, items: { 'auto-defense': 1, 'force-shield': 1 } },
        }),
      ],
    });

    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'nuke' });

    expect(events.some(event => event.type === 'shield-collapsed')).toBe(true);
    expect(events.some(event => event.type === 'shield-raised')).toBe(true);
    expect(round.tanks[1].shield?.tier).toBe('force');
    expect(round.getItemCount(2, 'force-shield')).toBe(0);
  });

  it('leaves a collapsed bubble down without Auto Defense, spare shields or not', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { nuke: 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN, {
          armedShieldItemId: 'shield',
          inventory: { weapons: {}, items: { 'force-shield': 1 } },
        }),
      ],
    });

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'nuke' });

    expect(round.tanks[1].shield).toBeUndefined();
    expect(round.getItemCount(2, 'force-shield')).toBe(1);
  });

  it("lets the owner's own descending shell through, soaking only the splash", () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, {
          inventory: { weapons: { nuke: 1 }, items: {} },
          armedShieldItemId: 'shield',
        }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    round.setAim({ facing: 'right', elevationDegrees: 90, power: 300 });

    const events = fireAndFly(round, { weaponId: 'nuke' });

    expect(events.some(event => event.type === 'shield-absorbed')).toBe(true);
    expect(events.some(event => event.type === 'shield-collapsed')).toBe(true);
    expect(round.tanks[0].health).toBeLessThan(MAX_TANK_HEALTH);
  });

  it('soaks a small self-inflicted splash entirely', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { armedShieldItemId: 'shield' }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    round.setAim({ facing: 'right', elevationDegrees: 90, power: 300 });

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.some(event => event.type === 'shield-absorbed')).toBe(true);
    expect(round.tanks[0].health).toBe(MAX_TANK_HEALTH);
    expect(round.tanks[0].shield?.remaining).toBeLessThan(SHIELD_CAPACITY_BY_TIER.shield);
  });
});

describe('raising a shield in the field', () => {
  function createShieldedRound(): ScorchedRound {
    return createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, {
          inventory: { weapons: {}, items: { shield: 2, 'heavy-shield': 1 } },
        }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
  }

  it('spends one bubble from the locker and puts it up', () => {
    const round = createShieldedRound();
    const events = round.raiseShield('shield');

    expect(events).toEqual([{ type: 'shield-raised', playerId: 1, tier: 'shield' }]);
    expect(round.tanks[0].shield?.remaining).toBe(SHIELD_CAPACITY_BY_TIER.shield);
    expect(round.getItemCount(1, 'shield')).toBe(1);
  });

  it('replaces whatever is standing rather than stacking with it', () => {
    const round = createShieldedRound();

    round.raiseShield('shield');
    round.raiseShield('heavy-shield');

    expect(round.tanks[0].shield?.tier).toBe('heavy');
    expect(round.tanks[0].shield?.remaining).toBe(SHIELD_CAPACITY_BY_TIER.heavy);
    expect(round.getItemCount(1, 'heavy-shield')).toBe(0);
  });

  it('refuses a bubble the tank does not own, and anything that is not one', () => {
    const round = createShieldedRound();

    expect(round.raiseShield('force-shield')).toEqual([]);
    expect(round.raiseShield('fuel')).toEqual([]);
    expect(round.tanks[0].shield).toBeUndefined();
  });

  it('stays out of a turn that is no longer the tank’s to spend', () => {
    const round = createShieldedRound();

    round.fire({ weaponId: 'baby-missile' });

    expect(round.raiseShield('shield')).toEqual([]);
    expect(round.getItemCount(1, 'shield')).toBe(2);
  });
});

describe('self-centered weapons', () => {
  it('digs the riot charge wedge over the firing tank and ends the turn', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, {
          inventory: { weapons: { 'riot-charge': 1 }, items: {} },
        }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
    const events = round.fire({ weaponId: 'riot-charge' });

    expect(events.some(event => event.type === 'terrain-carved' && event.shape === 'wedge')).toBe(
      true
    );
    expect(round.activePlayerId).toBe(2);
  });

  it('sizes the plasma blast by the batteries it burns', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, {
          inventory: { weapons: { 'plasma-blast': 1 }, items: { battery: 10 } },
        }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
    const events = round.fire({ weaponId: 'plasma-blast', plasmaBatteries: 10 });
    const explosion = events.find(event => event.type === 'explosion');

    expect(explosion).toEqual(expect.objectContaining({ radiusWu: 75 }));
    expect(round.getItemCount(1, 'battery')).toBe(0);
  });
});

describe('laser', () => {
  it('cuts straight through to a tank on the beam line', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { laser: 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    round.setAim({ facing: 'right', elevationDegrees: 0, power: 500 });

    const events = round.fire({ weaponId: 'laser' });

    expect(events.some(event => event.type === 'tank-damaged' && event.cause === 'laser')).toBe(
      true
    );
  });

  it('cannot touch a Super Mag', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { laser: 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN, { armedShieldItemId: 'super-mag' }),
      ],
    });

    round.setAim({ facing: 'right', elevationDegrees: 0, power: 500 });

    const events = round.fire({ weaponId: 'laser' });

    expect(events.some(event => event.type === 'tank-damaged')).toBe(false);
  });
});

describe('tank falls', () => {
  it('drops a tank whose ground was blown away without hurting it', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { 'riot-bomb': 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
      field: createFlatHeightfield(400, COLUMN_COUNT),
    });

    aimAtSecondTank(round);

    fireAndFly(round, { weaponId: 'riot-bomb' });

    expect(round.tanks[1].positionY).toBeLessThan(400);
    expect(round.tanks[1].health).toBe(MAX_TANK_HEALTH);
  });

  it('leaves tanks hanging when falls are switched off', () => {
    const round = createRound(
      {
        players: [
          createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { nuke: 1 }, items: {} } }),
          createPlayer(2, SECOND_COLUMN),
        ],
        field: createFlatHeightfield(400, COLUMN_COUNT),
      },
      { areTankFallsEnabled: false }
    );

    round.setAim({ facing: 'right', elevationDegrees: 45, power: 707.2 });
    fireAndFly(round, { weaponId: 'nuke' });

    expect(round.tanks[1].positionY).toBe(400);
  });
});

describe('turn order', () => {
  it('cycles through the living tanks in sequence', () => {
    const round = createRound({
      players: [createPlayer(1, 100), createPlayer(2, 400), createPlayer(3, 700)],
    });

    expect(round.activePlayerId).toBe(1);

    // A shot the locker cannot supply is refused, so the turn stays where it is.
    fireAndFly(round, { weaponId: 'nuke' });
    expect(round.activePlayerId).toBe(1);
  });

  it('passes the turn on after a shot', () => {
    const round = createRound();

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'baby-missile' });

    expect(round.activePlayerId).toBe(2);
  });

  it('re-rolls the wind after every shot when Changing Wind is on', () => {
    const round = createRound({}, { isWindChanging: true, maxWind: 200 });

    randomMock.mockReturnValue(150);
    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.some(event => event.type === 'wind-changed')).toBe(true);
    expect(round.windUnits).toBe(150);
  });
});

describe('retreat', () => {
  it('takes the tank out of the round and ends it', () => {
    const round = createRound();
    const events = round.retreat();

    expect(events[0]).toEqual(expect.objectContaining({ type: 'tank-retreated', playerId: 1 }));
    expect(round.outcome.retreatedIds).toEqual([1]);
    expect(round.phase).toBe('ended');
  });

  it('is refused once a shot is already in the air', () => {
    const round = createRound();

    round.fire({ weaponId: 'baby-missile' });

    expect(round.retreat()).toEqual([]);
  });
});

describe('dirt weapons', () => {
  it('buries the target column under a ton of dirt', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { 'ton-of-dirt': 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'ton-of-dirt' });

    expect(getSurfaceHeight(round.field, SECOND_COLUMN)).toBeGreaterThan(GROUND_HEIGHT_WU);
  });

  it('piles the dirt charge wedge over the firing tank itself', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { 'dirt-charge': 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'dirt-charge' });

    expect(getSurfaceHeight(round.field, FIRST_COLUMN)).toBeGreaterThan(GROUND_HEIGHT_WU);
    expect(round.tanks[0].health).toBe(MAX_TANK_HEALTH);
  });

  it('pours liquid dirt in portions and freezes it once the load runs out', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { 'liquid-dirt': 1 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });

    round.setAim({ facing: 'right', elevationDegrees: 45, power: 300 });

    const events = fireAndFly(round, { weaponId: 'liquid-dirt' });
    const pours = events.filter(event => event.type === 'dirt-poured');
    const settled = events.find(event => event.type === 'dirt-settled');

    expect(pours.length).toBe(LIQUID_DIRT_POUR_PORTIONS);
    expect(pours.every(pour => pour.columns.length > 0)).toBe(true);
    expect(settled?.type === 'dirt-settled' && settled.columns.length).toBeGreaterThan(0);
    expect(round.phase).not.toBe('flight');
  });
});

describe('tank centre', () => {
  it('places the shell at the muzzle, along the aim from the turret pivot', () => {
    const round = createRound();

    round.setAim({ facing: 'right', elevationDegrees: 45, power: 500 });
    round.fire({ weaponId: 'baby-missile' });

    const expected = getLaunchOrigin(FIRST_COLUMN + 0.5, GROUND_HEIGHT_WU, {
      facing: 'right',
      elevationDegrees: 45,
    });

    expect(round.projectiles[0].state.position).toEqual(expected);
  });
});

describe('guidance', () => {
  function createGuidedRound(items: PlayerInventory['items']): ScorchedRound {
    return createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: {}, items } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
  }

  it('keeps a permanent guidance device installed after the shot', () => {
    const round = createGuidedRound({ 'heat-guidance': 1 });

    round.fire({
      weaponId: 'baby-missile',
      guidance: 'heat-guidance',
      guidanceTarget: { x: SECOND_COLUMN, y: GROUND_HEIGHT_WU },
    });

    expect(round.getItemCount(1, 'heat-guidance')).toBe(1);
    expect(round.projectiles[0].guidance).toBe('heat-guidance');
  });

  it('flies unguided when the locker holds no guidance unit', () => {
    const round = createGuidedRound({});

    round.fire({
      weaponId: 'baby-missile',
      guidance: 'heat-guidance',
      guidanceTarget: { x: SECOND_COLUMN, y: GROUND_HEIGHT_WU },
    });

    expect(round.projectiles[0].guidance).toBeUndefined();
  });

  it('lets Lazy Boy aim the tank itself and fly the shot unguided', () => {
    const round = createGuidedRound({ 'lazy-boy': 1 });

    round.setAim({ facing: 'left', elevationDegrees: 5, power: 0 });
    round.fire({
      weaponId: 'baby-missile',
      guidance: 'lazy-boy',
      guidanceTarget: { x: SECOND_COLUMN + 0.5, y: GROUND_HEIGHT_WU + 4 },
    });

    const tank = round.getTank(1);

    expect(tank?.aim.facing).toBe('right');
    expect(tank?.aim.power).toBeGreaterThan(0);
    expect(round.projectiles[0].guidance).toBeUndefined();
    expect(round.getItemCount(1, 'lazy-boy')).toBe(1);
  });
});

describe('napalm burn', () => {
  /** Enough of a gap that a filler shot lands on bare ground rather than on anybody. */
  const HARMLESS_POWER = 300;

  function createNapalmRound(): ScorchedRound {
    return createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { napalm: 4 }, items: {} } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
  }

  function strikeSecondTank(round: ScorchedRound): void {
    aimAtSecondTank(round);
    fireAndFly(round, { weaponId: 'napalm' });
  }

  /** Whoever holds the turn lobs a baby missile out into empty ground, away from both tanks. */
  function passTurn(round: ScorchedRound): readonly WorldEvent[] {
    round.setAim({
      facing: round.activePlayerId === 1 ? 'left' : 'right',
      elevationDegrees: 45,
      power: HARMLESS_POWER,
    });

    return fireAndFly(round, { weaponId: 'baby-missile' });
  }

  it('burns the covered tank once at the strike and then goes out', () => {
    const round = createNapalmRound();

    strikeSecondTank(round);

    const healthAfterStrike = round.tanks[1].health;

    expect(healthAfterStrike).toBeLessThan(MAX_TANK_HEALTH);

    passTurn(round);
    passTurn(round);

    expect(round.tanks[1].health).toBe(healthAfterStrike);
  });

  it('announces the fire once — later turns replay nothing', () => {
    const round = createNapalmRound();

    strikeSecondTank(round);

    expect(passTurn(round).some(event => event.type === 'napalm-pooled')).toBe(false);
  });

  it('scores the burn to whoever threw the napalm', () => {
    const round = createNapalmRound();

    strikeSecondTank(round);

    const burns = round.outcome.damages.filter(damage => damage.targetId === 2);

    expect(burns.length).toBeGreaterThan(0);
    expect(burns.every(damage => damage.dealerId === 1)).toBe(true);
  });
});

describe('batteries in the field', () => {
  function createDamagedRound(health: number, batteries: number): ScorchedRound {
    return createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, {
          health,
          inventory: { weapons: {}, items: { battery: batteries } },
        }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
  }

  it('spends one battery for ten health and reports it', () => {
    const round = createDamagedRound(50, 3);
    const events = round.spendBattery();

    expect(round.tanks[0].health).toBe(50 + BATTERY_HEALTH_BONUS);
    expect(round.getItemCount(1, 'battery')).toBe(2);
    expect(events[0]).toEqual({
      type: 'tank-repaired',
      playerId: 1,
      amount: BATTERY_HEALTH_BONUS,
      health: 50 + BATTERY_HEALTH_BONUS,
    });
  });

  it('never wastes one on a tank that is already whole', () => {
    const round = createDamagedRound(MAX_TANK_HEALTH, 3);

    expect(round.spendBattery()).toEqual([]);
    expect(round.getItemCount(1, 'battery')).toBe(3);
  });

  it('does nothing without a battery in the locker', () => {
    const round = createDamagedRound(50, 0);

    expect(round.spendBattery()).toEqual([]);
    expect(round.tanks[0].health).toBe(50);
  });

  it('is refused once the shell is in the air', () => {
    const round = createDamagedRound(50, 3);

    round.fire({ weaponId: 'baby-missile' });

    expect(round.spendBattery()).toEqual([]);
  });
});

describe('driving on fuel', () => {
  function createFuelledRound(fuel: number): ScorchedRound {
    return createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: {}, items: { fuel } } }),
        createPlayer(2, SECOND_COLUMN),
      ],
    });
  }

  it('drives one column per request and bills the fuel', () => {
    const round = createFuelledRound(10);
    const events = round.moveWithFuelUnits(1);

    expect(round.tanks[0].columnIndex).toBe(FIRST_COLUMN + 1);
    expect(round.getItemCount(1, 'fuel')).toBe(10 - FUEL_COST_PER_WU);
    expect(events[0]).toEqual({
      type: 'tank-moved',
      playerId: 1,
      columnIndex: FIRST_COLUMN + 1,
      positionY: GROUND_HEIGHT_WU,
    });
  });

  it('drives the other way just as well', () => {
    const round = createFuelledRound(10);

    round.moveWithFuelUnits(-1);

    expect(round.tanks[0].columnIndex).toBe(FIRST_COLUMN - 1);
  });

  it('stays put on an empty tank', () => {
    const round = createFuelledRound(0);

    expect(round.moveWithFuelUnits(1)).toEqual([]);
    expect(round.tanks[0].columnIndex).toBe(FIRST_COLUMN);
  });

  it('is refused once the shell is in the air', () => {
    const round = createFuelledRound(10);

    round.fire({ weaponId: 'baby-missile' });

    expect(round.moveWithFuelUnits(1)).toEqual([]);
  });

  it('charges an uphill drive its true price via the fractional credit', () => {
    const climbPerColumn = 0.5;
    const columnCount = 800;
    const field = Array.from({ length: columnCount }, (_unused, column) =>
      column <= FIRST_COLUMN
        ? GROUND_HEIGHT_WU
        : GROUND_HEIGHT_WU + (column - FIRST_COLUMN) * climbPerColumn
    );
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: {}, items: { fuel: 10 } } }),
        createPlayer(2, SECOND_COLUMN),
      ],
      field: field.map(height => ({
        surfaceHeight: height,
        tunnels: [],
        suspendedGaps: [],
      })),
    });

    // Four climbing columns at 1.5 fuel each cost 6 in total — not four rounded-up doubles.
    for (let drive = 0; drive < 4; drive++) {
      round.moveWithFuelUnits(1);
    }

    expect(round.tanks[0].columnIndex).toBe(FIRST_COLUMN + 4);
    expect(round.getItemCount(1, 'fuel')).toBe(10 - 6);
  });
});

describe('rolling shells', () => {
  const TARGET_COLUMN = 600;

  function createRollerRound(targetShieldItemId?: 'shield'): ScorchedRound {
    return createRound({
      players: [
        createPlayer(1, FIRST_COLUMN, { inventory: { weapons: { roller: 1 }, items: {} } }),
        createPlayer(2, TARGET_COLUMN, { armedShieldItemId: targetShieldItemId }),
      ],
    });
  }

  /** A weak lob to the right: lands well short of the target and has to roll the rest. */
  function fireShortLob(round: ScorchedRound): readonly WorldEvent[] {
    round.setAim({ facing: 'right', elevationDegrees: 45, power: 300 });

    return fireAndFly(round, { weaponId: 'roller' });
  }

  it('crawls on in its flight direction and detonates on the tank it touches', () => {
    const round = createRollerRound();
    const events = fireShortLob(round);
    const explosion = events.find(event => event.type === 'explosion');

    expect(explosion?.type === 'explosion' && explosion.position.x).toBeCloseTo(
      TARGET_COLUMN + 0.5
    );
    expect(round.tanks[1].health).toBeLessThan(MAX_TANK_HEALTH);
  });

  it('announces the touchdown, where the shell turns into a crawling mine', () => {
    const round = createRollerRound();
    const events = fireShortLob(round);

    expect(events.some(event => event.type === 'roller-landed')).toBe(true);
  });

  it('detonates short of a shielded tank instead of rolling off it', () => {
    const round = createRollerRound('shield');
    const events = fireShortLob(round);
    const explosion = events.find(event => event.type === 'explosion');
    const explosionX = explosion?.type === 'explosion' ? explosion.position.x : Number.NaN;

    expect(explosionX).toBeLessThan(TARGET_COLUMN + 0.5 - TANK_HALF_WIDTH_WU);
    expect(explosionX).toBeGreaterThan(FIRST_COLUMN);
  });
});

describe('mag deflectors', () => {
  it('announces the tick a deflector takes hold, and only that tick', () => {
    const round = createRound({
      players: [
        createPlayer(1, FIRST_COLUMN),
        createPlayer(2, SECOND_COLUMN, {
          inventory: { weapons: {}, items: { 'mag-deflector': 1 } },
        }),
      ],
    });

    aimAtSecondTank(round);

    const events = fireAndFly(round, { weaponId: 'baby-missile' });

    expect(events.filter(event => event.type === 'mag-deflected')).toHaveLength(1);
  });
});
