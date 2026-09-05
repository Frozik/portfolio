import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ARMS_LEVEL,
  DEFAULT_INTEREST_PERCENT,
  DEFAULT_PHYSICS_OPTIONS,
  DEFAULT_TERRAIN_OPTIONS,
  MAX_FLIGHT_TICKS,
  MAX_TANK_HEALTH,
  TERRAIN_COLUMN_COUNT,
} from './constants';
import { getItem } from './items/catalog';
import { getSpawnColumns, ScorchedMatch } from './match';
import { createFlatHeightfield } from './terrain/heightfield';
import type { MatchOptions, PlayerSetup } from './types';
import { toPlayerId } from './types';
import { getWeapon } from './weapons/catalog';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const GROUND_HEIGHT_WU = 100;
const STARTING_CASH = 50000;
const MISSILE = getWeapon('missile');

const PLAYERS: readonly PlayerSetup[] = [
  { id: toPlayerId(1), name: 'One', controller: { kind: 'human' } },
  { id: toPlayerId(2), name: 'Two', controller: { kind: 'ai', personality: 'moron' } },
];

function createMatch(overrides: Partial<MatchOptions> = {}): ScorchedMatch {
  return new ScorchedMatch({
    players: PLAYERS,
    roundCount: 2,
    startingCash: STARTING_CASH,
    interestPercent: DEFAULT_INTEREST_PERCENT,
    armsLevel: DEFAULT_ARMS_LEVEL,
    playOrder: 'sequential',
    physics: { ...DEFAULT_PHYSICS_OPTIONS, maxWind: 0 },
    terrain: DEFAULT_TERRAIN_OPTIONS,
    ...overrides,
  });
}

/** Plays the round out by letting the first tank nuke the second. */
function playRoundToEnd(match: ScorchedMatch): void {
  const round = match.round;

  if (round === undefined) {
    return;
  }

  while (round.phase !== 'ended') {
    round.setAim({ facing: 'right', elevationDegrees: 45, power: 686.8 });
    round.fire({ weaponId: 'nuke' });

    for (let tick = 0; tick < MAX_FLIGHT_TICKS && round.phase === 'flight'; tick++) {
      round.tick();
    }

    if (round.phase === 'aiming') {
      round.retreat();
    }
  }
}

beforeEach(() => {
  randomMock.mockReset();
  randomMock.mockReturnValue(0);
});

describe('getSpawnColumns', () => {
  it('spreads the roster evenly across the field', () => {
    expect(getSpawnColumns(2, 800)).toEqual([200, 600]);
    expect(getSpawnColumns(4, 800)).toEqual([100, 300, 500, 700]);
  });

  it('keeps the last tank inside the field', () => {
    expect(Math.max(...getSpawnColumns(3))).toBeLessThan(TERRAIN_COLUMN_COUNT);
  });
});

describe('match setup', () => {
  it('opens in the shop with everyone on the starting cash', () => {
    const match = createMatch();

    expect(match.phase).toBe('shop');
    expect(match.roundNumber).toBe(1);
    expect(match.players.every(player => player.cash === STARTING_CASH)).toBe(true);
  });

  it('reports how many rounds are left to play', () => {
    expect(createMatch({ roundCount: 10 }).roundsRemaining).toBe(10);
  });
});

describe('shop phase gate', () => {
  it('sells a bundle while the shop is open', () => {
    const match = createMatch();

    expect(match.buyWeapon(toPlayerId(1), 'missile')).toBe(true);
    expect(match.players[0].weapons.missile).toBe(MISSILE.bundleSize);
    expect(match.players[0].cash).toBe(STARTING_CASH - MISSILE.cost);
  });

  it('refuses to sell once a round is under way', () => {
    const match = createMatch();

    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(match.buyWeapon(toPlayerId(1), 'missile')).toBe(false);
  });

  it('refuses a weapon above the match arms level', () => {
    const match = createMatch({ armsLevel: 0 });

    expect(match.buyWeapon(toPlayerId(1), 'funky-bomb')).toBe(false);
    expect(match.buyWeapon(toPlayerId(1), 'missile')).toBe(true);
  });

  it('refuses an accessory above the match arms level', () => {
    const match = createMatch({ armsLevel: 0 });

    expect(match.buyItem(toPlayerId(1), 'super-mag')).toBe(false);
    expect(match.buyItem(toPlayerId(1), 'battery')).toBe(true);
  });

  it('refuses a bundle the player cannot afford', () => {
    const match = createMatch({ startingCash: 100 });

    expect(match.buyWeapon(toPlayerId(1), 'missile')).toBe(false);
    expect(match.players[0].cash).toBe(100);
  });

  it('buys back shells at the quoted price', () => {
    const match = createMatch();

    match.buyWeapon(toPlayerId(1), 'missile');

    expect(match.sellWeapon(toPlayerId(1), 'missile', 2)).toBe(true);
    expect(match.players[0].weapons.missile).toBe(MISSILE.bundleSize - 2);
    expect(match.players[0].cash).toBe(STARTING_CASH - MISSILE.cost + 600);
  });

  it('refuses to sell what the player does not have', () => {
    expect(createMatch().sellWeapon(toPlayerId(1), 'nuke', 1)).toBe(false);
  });
});

describe('rounds', () => {
  it('starts a round with every tank at full health on its own column', () => {
    const match = createMatch();

    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(match.phase).toBe('round');
    expect(match.round?.tanks).toHaveLength(2);
    expect(match.round?.tanks.every(tank => tank.health === MAX_TANK_HEALTH)).toBe(true);
    expect(match.round?.tanks.map(tank => tank.columnIndex)).toEqual(getSpawnColumns(2));
  });

  it('refuses to start a second round on top of the first', () => {
    const match = createMatch();

    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(() => match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU))).toThrow();
  });

  it('refuses to complete a round that is still being played', () => {
    const match = createMatch();

    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(() => match.completeRound()).toThrow();
  });

  it('hands the round the weapons the shop sold', () => {
    const match = createMatch();

    match.buyWeapon(toPlayerId(1), 'missile');
    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(match.round?.getAmmoCount(toPlayerId(1), 'missile')).toBe(MISSILE.bundleSize);
  });
});

describe('banking between rounds', () => {
  it('adds the round winnings and pays interest on the bank', () => {
    const match = createMatch();

    match.buyWeapon(toPlayerId(1), 'nuke');

    const cashAfterShopping = match.players[0].cash;

    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));
    playRoundToEnd(match);
    match.completeRound();

    expect(match.players[0].cash).toBeGreaterThan(cashAfterShopping);
    expect(match.players[1].cash).toBe(
      Math.floor(STARTING_CASH * (1 + DEFAULT_INTEREST_PERCENT / 100))
    );
  });

  it('sells a permanent device once and refuses a second unit', () => {
    const match = createMatch();

    expect(match.buyItem(toPlayerId(1), 'vertical-guidance')).toBe(true);
    expect(match.buyItem(toPlayerId(1), 'vertical-guidance')).toBe(false);
    expect(match.players[0].items['vertical-guidance']).toBe(1);
  });

  it('announces the Auto Defense bubble as the round opens', () => {
    const match = createMatch();

    match.buyItem(toPlayerId(1), 'auto-defense');
    match.buyItem(toPlayerId(1), 'shield');

    const events = match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(events).toContainEqual({ type: 'shield-raised', playerId: 1, tier: 'shield' });
  });

  it('keeps the ammo the round spent out of the next round', () => {
    const match = createMatch();

    match.buyWeapon(toPlayerId(1), 'nuke');

    const boughtNukes = match.players[0].weapons.nuke ?? 0;

    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));
    playRoundToEnd(match);
    match.completeRound();

    expect(match.players[0].weapons.nuke ?? 0).toBeLessThan(boughtNukes);
  });

  it('re-opens the shop after a round and moves on to the next one', () => {
    const match = createMatch();

    match.buyWeapon(toPlayerId(1), 'nuke');
    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));
    playRoundToEnd(match);
    match.completeRound();

    expect(match.phase).toBe('shop');
    expect(match.roundNumber).toBe(2);
    expect(match.round).toBeUndefined();
  });

  it('finishes the match after the last round', () => {
    const match = createMatch({ roundCount: 1 });

    match.buyWeapon(toPlayerId(1), 'nuke');
    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));
    playRoundToEnd(match);
    match.completeRound();

    expect(match.phase).toBe('finished');
    expect(match.roundsRemaining).toBe(0);
  });
});

describe('standings', () => {
  it('ranks the roster on aggregate kills', () => {
    const match = createMatch({ roundCount: 1 });

    match.buyWeapon(toPlayerId(1), 'nuke');
    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));
    playRoundToEnd(match);
    match.completeRound();

    expect(match.standings[0].playerId).toBe(1);
    expect(match.standings[0].kills).toBe(1);
    expect(match.standings[1].kills).toBe(0);
  });
});

describe('auto defense', () => {
  it('arms the best bubble the tank owns as the round opens', () => {
    const match = createMatch();

    match.buyItem(toPlayerId(1), 'auto-defense');
    match.buyItem(toPlayerId(1), 'heavy-shield');
    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(match.round?.tanks[0].shield?.tier).toBe('heavy');
    expect(match.players[0].items['heavy-shield']).toBe(getItem('heavy-shield').bundleSize - 1);
  });

  it('arms nothing without the Auto Defense unit', () => {
    const match = createMatch();

    match.buyItem(toPlayerId(1), 'heavy-shield');
    match.startRound(createFlatHeightfield(GROUND_HEIGHT_WU));

    expect(match.round?.tanks[0].shield).toBeUndefined();
  });
});
