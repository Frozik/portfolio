import { shuffle } from 'lodash-es';

import { rollWind } from '../ballistics';
import { MIN_TANK_HEALTH } from '../constants';
import { createMagDeflector, createShield } from '../items/behaviors';
import { RoundInventories } from '../round-inventory';
import type { DamageRecord, KillRecord } from '../scoring';
import { getTankCenter } from '../tank-geometry';
import type { Heightfield } from '../terrain/heightfield';
import { getSurfaceHeight } from '../terrain/heightfield';
import type {
  ItemId,
  MagDeflectorState,
  PhysicsOptions,
  PlayerId,
  PlayerInventory,
  PlayOrder,
  Projectile,
  ResolvedWallMode,
  RoundPhase,
  TankState,
  WorldEvent,
} from '../types';
import { resolveWallMode } from '../walls';

export interface RoundPlayerSetup {
  readonly id: PlayerId;
  readonly columnIndex: number;
  readonly health: number;
  readonly inventory: PlayerInventory;
  /** [MANUAL §7] The bubble Auto Defense (or the player) armed before the round opened. */
  readonly armedShieldItemId?: ItemId;
}

export interface RoundOptions {
  readonly roundNumber: number;
  readonly players: readonly RoundPlayerSetup[];
  readonly field: Heightfield;
  readonly physics: PhysicsOptions;
  readonly playOrder: PlayOrder;
}

/** The Super Mag's field replaces a plain deflector when a tank happens to own both. */
const MAG_DEFLECTOR_PREFERENCE: readonly ItemId[] = ['super-mag', 'mag-deflector'];

const DEFAULT_ELEVATION_DEGREES = 45;
const FIRST_ID = 1;

/**
 * Everything one round mutates while it plays. The step modules next to this file drive it in
 * place, 60 times a second while a shell flies; `ScorchedRound` is its public face.
 */
export interface RoundState {
  readonly options: RoundOptions;
  /** Reused between calls — consumers must read it before driving the round again. */
  readonly events: WorldEvent[];
  readonly tanks: TankState[];
  readonly inventories: RoundInventories;
  readonly damageRecords: DamageRecord[];
  readonly killRecords: KillRecord[];
  readonly retreatedIds: PlayerId[];
  readonly turnOrder: readonly PlayerId[];
  field: Heightfield;
  projectiles: Projectile[];
  magDeflectors: readonly MagDeflectorState[];
  turnIndex: number;
  settleTicksRemaining: number;
  phase: RoundPhase;
  windUnits: number;
  wallMode: ResolvedWallMode;
  nextProjectileId: number;
  nextShotId: number;
}

function createTank(field: Heightfield, player: RoundPlayerSetup): TankState {
  return {
    playerId: player.id,
    columnIndex: player.columnIndex,
    positionY: getSurfaceHeight(field, player.columnIndex),
    health: player.health,
    aim: { facing: 'right', elevationDegrees: DEFAULT_ELEVATION_DEGREES, power: 0 },
    shield:
      player.armedShieldItemId === undefined ? undefined : createShield(player.armedShieldItemId),
    fuelCreditWu: 0,
    isAlive: player.health > MIN_TANK_HEALTH,
    hasRetreated: false,
  };
}

function createMagDeflectors(
  tanks: readonly TankState[],
  inventories: RoundInventories
): readonly MagDeflectorState[] {
  return tanks.flatMap(tank => {
    const itemId = MAG_DEFLECTOR_PREFERENCE.find(
      candidate => inventories.getItemCount(tank.playerId, candidate) > 0
    );

    return itemId === undefined
      ? []
      : [createMagDeflector(itemId, tank.playerId, getTankCenter(tank))];
  });
}

export function createRoundState(options: RoundOptions): RoundState {
  const tanks = options.players.map(player => createTank(options.field, player));
  const inventories = new RoundInventories(options.players);
  const aliveIds = tanks.filter(tank => tank.isAlive).map(tank => tank.playerId);

  return {
    options,
    events: [],
    tanks,
    inventories,
    damageRecords: [],
    killRecords: [],
    retreatedIds: [],
    turnOrder: options.playOrder === 'random' ? shuffle(aliveIds) : aliveIds,
    field: options.field,
    projectiles: [],
    magDeflectors: createMagDeflectors(tanks, inventories),
    turnIndex: 0,
    settleTicksRemaining: 0,
    phase: 'aiming',
    windUnits: rollWind(options.physics.maxWind),
    wallMode: resolveWallMode(options.physics.wallMode),
    nextProjectileId: FIRST_ID,
    nextShotId: FIRST_ID,
  };
}
