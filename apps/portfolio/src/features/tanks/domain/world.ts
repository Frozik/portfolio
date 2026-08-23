import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { BulletHit, IBulletTarget } from './bullets';
import {
  countAliveBullets,
  createBullet,
  getEnemyBulletTraits,
  getMaxBulletsForStarLevel,
  getPlayerBulletTraits,
  isFireRisingEdge,
  stepBullets,
} from './bullets';
import {
  CELL_SIZE_WU,
  ENEMIES_PER_STAGE,
  ENEMY_HIT_POINTS_BY_TYPE,
  ENEMY_SPAWN_TWINKLE_TICKS,
  ENEMY_SPEED_BY_TYPE_WU_PER_SECOND,
  INITIAL_LIVES,
  MAX_ENEMIES_ON_FIELD,
  MIN_STAR_LEVEL,
  PLAYER_SLOT_COUNT,
  POWER_UP_PICKUP_POINTS,
  POWER_UP_SIZE_WU,
  SPAWN_SHIELD_TICKS,
  STAGE_COUNT,
  TANK_SIZE_WU,
} from './constants';
import type { IEnemyAiContext } from './enemy-ai';
import { decideBlockedReaction, decideEnemyAction } from './enemy-ai';
import type { FieldGeometry, PowerUpGrid } from './field';
import {
  createFieldGeometry,
  createPowerUpGrid,
  findBaseCell,
  getBaseCenter,
  getBaseWallCells,
  getEnemySpawnPositionsX,
  getPlayerSpawnPositions,
} from './field';
import { getStageByNumber } from './levels/registry';
import type { IMovementContext, TankBox } from './movement';
import { advanceTank, boxesOverlap, rectanglesOverlap, updatePlayerMovement } from './movement';
import type { BaseWallMaterial } from './power-ups';
import {
  getBaseWallMaterial,
  getPowerUpEffect,
  rollPowerUpPosition,
  rollPowerUpType,
  upgradeStarLevel,
} from './power-ups';
import { getEnemyPoints, shouldAwardExtraLife } from './scoring';
import { computeSpawnIntervalTicks, EnemySpawnScheduler } from './spawning';
import { BRICK_CELL, STEEL_CELL, Terrain } from './terrain';
import type {
  Bullet,
  Direction,
  EnemyTank,
  IBulletTraits,
  PlayerInputs,
  PlayerTank,
  PowerUpDrop,
  PowerUpType,
  StageDefinition,
  TankRef,
  TerrainKind,
  WorldEvent,
} from './types';

export type GameStatus = 'playing' | 'stage-cleared' | 'game-over';

interface BulletShooter extends TankBox {
  readonly direction: Direction;
}

const IDLE_INPUTS: PlayerInputs = { direction: undefined, fire: false };

/** Free ground, ice and trees are all fine to drop a bonus on; these are not. */
const POWER_UP_INVALID_TERRAIN_KINDS: readonly TerrainKind[] = ['steel', 'water', 'eagle'];

function createPlayerTank(slot: number, isActive: boolean, spawnPosition: Vector2): PlayerTank {
  return {
    slot,
    isActive,
    positionX: spawnPosition.x,
    positionY: spawnPosition.y,
    direction: 'up',
    movementRemainder: 0,
    starLevel: MIN_STAR_LEVEL,
    shieldTicksRemaining: SPAWN_SHIELD_TICKS,
    isIceSliding: false,
    iceSlideDirection: 'up',
    iceSlideBudgetWu: 0,
  };
}

function resolveBaseCell(stage: StageDefinition, geometry: FieldGeometry): Vector2 {
  const baseCell = findBaseCell(stage.terrain, geometry);

  assert(!isNil(baseCell), `stage ${stage.stageNumber} has no eagle on its map`);

  return baseCell;
}

function getTankCenter(tank: TankBox): Vector2 {
  return { x: tank.positionX + TANK_SIZE_WU / 2, y: tank.positionY + TANK_SIZE_WU / 2 };
}

export class TanksWorld {
  /** Reused between ticks — consumers must read it before calling `tick` again. */
  private readonly events: WorldEvent[] = [];
  private readonly playerTanks: readonly PlayerTank[];
  private enemyTanks: EnemyTank[] = [];
  private aliveBullets: Bullet[] = [];
  private stage: StageDefinition;
  private geometry: FieldGeometry;
  private terrainState: Terrain;
  private baseCell: Vector2;
  private baseWallCells: readonly Vector2[];
  private playerSpawnPositions: readonly Vector2[];
  private powerUpGrid: PowerUpGrid;
  private spawner: EnemySpawnScheduler;
  private spawnIntervalTicks: number;
  private stageTicks = 0;
  private loopNumber = 1;
  private scoreValue = 0;
  private livesValue = INITIAL_LIVES;
  private statusValue: GameStatus = 'playing';
  private powerUpDrop: PowerUpDrop | undefined;
  private freezeTicksRemaining = 0;
  private shovelTicksRemaining = 0;
  private baseWallMaterial: BaseWallMaterial = 'brick';
  private isBaseDestroyedValue = false;
  private isExtraLifeAwarded = false;
  private isPreviousFirePressed = false;
  private isStageStartPending = true;
  private nextBulletId = 1;

  constructor(options: { readonly stageNumber?: number } = {}) {
    this.stage = getStageByNumber(options.stageNumber ?? 1);
    this.geometry = createFieldGeometry(this.stage.fieldWidthTiles, this.stage.fieldHeightTiles);
    this.terrainState = new Terrain(this.stage.terrain, this.geometry);
    this.baseCell = resolveBaseCell(this.stage, this.geometry);
    this.baseWallCells = getBaseWallCells(this.geometry, this.baseCell);
    this.playerSpawnPositions = getPlayerSpawnPositions(this.geometry, this.baseCell);
    this.powerUpGrid = createPowerUpGrid(this.geometry);
    this.spawnIntervalTicks = computeSpawnIntervalTicks(this.stage.stageNumber, this.loopNumber);
    this.spawner = new EnemySpawnScheduler(
      this.spawnIntervalTicks,
      getEnemySpawnPositionsX(this.geometry)
    );
    this.playerTanks = Array.from({ length: PLAYER_SLOT_COUNT }, (_unused, slot) =>
      createPlayerTank(slot, slot === 0, this.playerSpawnPositions[slot])
    );
  }

  get status(): GameStatus {
    return this.statusValue;
  }

  get stageNumber(): number {
    return this.stage.stageNumber;
  }

  get loop(): number {
    return this.loopNumber;
  }

  get score(): number {
    return this.scoreValue;
  }

  get lives(): number {
    return this.livesValue;
  }

  /** Enemies of this stage that are still alive or still waiting to spawn — the HUD icons. */
  get enemiesRemaining(): number {
    return ENEMIES_PER_STAGE - this.spawner.spawnedCount + this.enemyTanks.length;
  }

  get ticksSinceStageStart(): number {
    return this.stageTicks;
  }

  get terrain(): Terrain {
    return this.terrainState;
  }

  get players(): readonly PlayerTank[] {
    return this.playerTanks;
  }

  get enemies(): readonly EnemyTank[] {
    return this.enemyTanks;
  }

  get bullets(): readonly Bullet[] {
    return this.aliveBullets;
  }

  get powerUp(): PowerUpDrop | undefined {
    return this.powerUpDrop;
  }

  get isBaseDestroyed(): boolean {
    return this.isBaseDestroyedValue;
  }

  get isEnemyFreezeActive(): boolean {
    return this.freezeTicksRemaining > 0;
  }

  tick(inputs: PlayerInputs): readonly WorldEvent[] {
    this.events.length = 0;

    if (this.isStageStartPending) {
      this.events.push({ type: 'stage-started', stageNumber: this.stage.stageNumber });
      this.isStageStartPending = false;
    }

    if (this.statusValue !== 'playing') {
      return this.events;
    }

    this.updateTimers();
    this.updateSpawning();
    this.updatePlayers(inputs);
    this.updateEnemies();
    this.updateBullets();
    this.collectPowerUp();
    this.updateStageCompletion();
    this.stageTicks++;

    return this.events;
  }

  advanceToNextStage(): void {
    assert(this.statusValue === 'stage-cleared', 'the stage is not cleared yet');

    const isLastStage = this.stage.stageNumber >= STAGE_COUNT;
    if (isLastStage) {
      this.loopNumber++;
    }

    this.startStage(isLastStage ? 1 : this.stage.stageNumber + 1);
  }

  private startStage(stageNumber: number): void {
    this.stage = getStageByNumber(stageNumber);
    this.geometry = createFieldGeometry(this.stage.fieldWidthTiles, this.stage.fieldHeightTiles);
    this.terrainState = new Terrain(this.stage.terrain, this.geometry);
    this.baseCell = resolveBaseCell(this.stage, this.geometry);
    this.baseWallCells = getBaseWallCells(this.geometry, this.baseCell);
    this.playerSpawnPositions = getPlayerSpawnPositions(this.geometry, this.baseCell);
    this.powerUpGrid = createPowerUpGrid(this.geometry);
    this.spawnIntervalTicks = computeSpawnIntervalTicks(stageNumber, this.loopNumber);
    this.spawner = new EnemySpawnScheduler(
      this.spawnIntervalTicks,
      getEnemySpawnPositionsX(this.geometry)
    );
    this.enemyTanks = [];
    this.aliveBullets = [];
    this.powerUpDrop = undefined;
    this.freezeTicksRemaining = 0;
    this.shovelTicksRemaining = 0;
    this.baseWallMaterial = 'brick';
    this.stageTicks = 0;
    this.statusValue = 'playing';
    this.isStageStartPending = true;
    this.isPreviousFirePressed = false;

    for (const player of this.playerTanks) {
      this.placePlayerAtSpawn(player);
    }
  }

  private placePlayerAtSpawn(player: PlayerTank): void {
    const spawnPosition = this.playerSpawnPositions[player.slot];

    player.positionX = spawnPosition.x;
    player.positionY = spawnPosition.y;
    player.direction = 'up';
    player.movementRemainder = 0;
    player.shieldTicksRemaining = SPAWN_SHIELD_TICKS;
    player.isIceSliding = false;
    player.iceSlideBudgetWu = 0;
  }

  private updateTimers(): void {
    for (const player of this.playerTanks) {
      if (player.shieldTicksRemaining > 0) {
        player.shieldTicksRemaining--;
      }
    }

    if (this.freezeTicksRemaining > 0) {
      this.freezeTicksRemaining--;
    }

    if (this.shovelTicksRemaining > 0) {
      this.shovelTicksRemaining--;
    }

    this.applyBaseWalls(getBaseWallMaterial(this.shovelTicksRemaining));
  }

  private applyBaseWalls(material: BaseWallMaterial): void {
    if (material === this.baseWallMaterial) {
      return;
    }

    this.baseWallMaterial = material;

    for (const cell of this.baseWallCells) {
      this.terrainState.setCell(cell.x, cell.y, material === 'steel' ? STEEL_CELL : BRICK_CELL);
    }
  }

  private updateSpawning(): void {
    const request = this.spawner.tick(this.enemyTanks.length < MAX_ENEMIES_ON_FIELD);

    if (isNil(request)) {
      return;
    }

    if (request.isPowerUpCarrier) {
      this.powerUpDrop = undefined;
    }

    const enemyType = this.stage.enemyQueue[request.spawnIndex];
    const enemy: EnemyTank = {
      slot: this.findFreeEnemySlot(),
      type: enemyType,
      spawnIndex: request.spawnIndex,
      isPowerUpCarrier: request.isPowerUpCarrier,
      positionX: request.positionX,
      positionY: request.positionY,
      direction: 'down',
      movementRemainder: 0,
      hitPoints: ENEMY_HIT_POINTS_BY_TYPE[enemyType],
      twinkleTicksRemaining: ENEMY_SPAWN_TWINKLE_TICKS,
      brakeTicksRemaining: 0,
    };

    this.enemyTanks.push(enemy);
    this.events.push({
      type: 'enemy-spawned',
      slot: enemy.slot,
      enemyType,
      isPowerUpCarrier: enemy.isPowerUpCarrier,
    });
  }

  private findFreeEnemySlot(): number {
    for (let slot = 0; slot < MAX_ENEMIES_ON_FIELD; slot++) {
      if (!this.enemyTanks.some(enemy => enemy.slot === slot)) {
        return slot;
      }
    }

    return 0;
  }

  private updatePlayers(inputs: PlayerInputs): void {
    for (const player of this.playerTanks) {
      if (!player.isActive) {
        continue;
      }

      const playerInputs = player.slot === 0 ? inputs : IDLE_INPUTS;
      const wasIceSliding = player.isIceSliding;

      updatePlayerMovement(player, playerInputs, this.createMovementContext(player));

      if (!wasIceSliding && player.isIceSliding) {
        this.events.push({ type: 'player-ice-slide-started', playerSlot: player.slot });
      }

      if (
        isFireRisingEdge(this.isPreviousFirePressed, playerInputs.fire) &&
        this.canFire(
          { side: 'player', slot: player.slot },
          getMaxBulletsForStarLevel(player.starLevel)
        )
      ) {
        this.spawnBullet(
          { side: 'player', slot: player.slot },
          player,
          getPlayerBulletTraits(player.starLevel)
        );
      }
    }

    this.isPreviousFirePressed = inputs.fire;
  }

  private updateEnemies(): void {
    const aiContext = this.createAiContext();

    for (const enemy of this.enemyTanks) {
      if (enemy.twinkleTicksRemaining > 0) {
        enemy.twinkleTicksRemaining--;
        continue;
      }

      if (this.freezeTicksRemaining > 0) {
        continue;
      }

      const owner: TankRef = { side: 'enemy', slot: enemy.slot };
      const decision = decideEnemyAction(
        enemy,
        aiContext,
        countAliveBullets(this.aliveBullets, owner) > 0
      );

      if (decision.fire) {
        this.spawnBullet(owner, enemy, getEnemyBulletTraits(enemy.type));
      }

      if (enemy.brakeTicksRemaining > 0) {
        enemy.brakeTicksRemaining--;
        continue;
      }

      const stepResult = advanceTank(
        enemy,
        decision.direction,
        ENEMY_SPEED_BY_TYPE_WU_PER_SECOND[enemy.type],
        this.createMovementContext(enemy)
      );

      if (!stepResult.isBlocked) {
        continue;
      }

      const reaction = decideBlockedReaction(enemy, aiContext);

      switch (reaction.kind) {
        case 'brake':
          enemy.brakeTicksRemaining = reaction.ticks;
          break;
        case 'turn':
          enemy.direction = reaction.direction;
          break;
        default:
          assertNever(reaction);
      }
    }
  }

  private updateBullets(): void {
    const hits = stepBullets(this.aliveBullets, {
      terrain: this.terrainState,
      targets: this.collectBulletTargets(),
    });

    for (const hit of hits) {
      this.applyBulletHit(hit);
    }

    this.aliveBullets = this.aliveBullets.filter(bullet => bullet.isAlive);
  }

  private applyBulletHit(hit: BulletHit): void {
    switch (hit.kind) {
      case 'terrain':
        this.events.push({
          type: 'bullet-ended',
          position: hit.position,
          reason: hit.hitBorder ? 'border' : hit.hitSteel ? 'steel' : 'terrain',
        });
        break;
      case 'eagle':
        this.events.push({ type: 'bullet-ended', position: hit.position, reason: 'eagle' });
        this.destroyBase();
        break;
      case 'bullet':
        this.events.push({ type: 'bullet-ended', position: hit.position, reason: 'bullet' });
        break;
      case 'tank':
        this.events.push({ type: 'bullet-ended', position: hit.position, reason: 'tank' });
        this.damageTank(hit.target);
        break;
      default:
        assertNever(hit);
    }
  }

  private damageTank(target: TankRef): void {
    switch (target.side) {
      case 'player':
        this.damagePlayer(target.slot);
        break;
      case 'enemy':
        this.damageEnemy(target.slot);
        break;
      default:
        assertNever(target.side);
    }
  }

  private damagePlayer(slot: number): void {
    const player = this.playerTanks[slot];
    const isVulnerable = !isNil(player) && player.isActive && player.shieldTicksRemaining <= 0;

    // Several bullets can land in the same tick; the ones after the fatal hit must not count.
    if (!isVulnerable || this.statusValue !== 'playing') {
      return;
    }

    this.events.push({
      type: 'player-destroyed',
      playerSlot: slot,
      position: getTankCenter(player),
    });

    this.livesValue--;
    player.starLevel = MIN_STAR_LEVEL;

    if (this.livesValue <= 0) {
      this.endGame();

      return;
    }

    this.placePlayerAtSpawn(player);
  }

  private damageEnemy(slot: number): void {
    const enemy = this.enemyTanks.find(candidate => candidate.slot === slot);

    if (isNil(enemy)) {
      return;
    }

    enemy.hitPoints--;

    if (enemy.hitPoints > 0) {
      return;
    }

    this.destroyEnemy(enemy, true);
  }

  private destroyEnemy(enemy: EnemyTank, awardsPoints: boolean): void {
    this.enemyTanks = this.enemyTanks.filter(candidate => candidate !== enemy);

    if (!awardsPoints) {
      return;
    }

    const points = getEnemyPoints(enemy.type);

    this.events.push({
      type: 'enemy-destroyed',
      enemyType: enemy.type,
      position: getTankCenter(enemy),
      points,
    });
    this.addScore(points);

    if (enemy.isPowerUpCarrier) {
      this.spawnPowerUp();
    }
  }

  private spawnPowerUp(): void {
    const powerUpType = rollPowerUpType();
    const position = rollPowerUpPosition(this.powerUpGrid, candidate =>
      this.isPowerUpSpotBlocked(candidate)
    );

    this.powerUpDrop = { type: powerUpType, positionX: position.x, positionY: position.y };
    this.events.push({ type: 'power-up-spawned', powerUpType, position });
  }

  /** The ROM only re-rolls on tanks; we also refuse unreachable spots and the base nest (§9). */
  private isPowerUpSpotBlocked(position: Vector2): boolean {
    return (
      this.isPositionOverTank(position) ||
      this.isPositionOnUnreachableTerrain(position) ||
      this.isPositionOnBaseNest(position)
    );
  }

  private isPositionOnUnreachableTerrain(position: Vector2): boolean {
    return POWER_UP_INVALID_TERRAIN_KINDS.some(kind =>
      this.terrainState.isBoxOverKind(position.x, position.y, POWER_UP_SIZE_WU, kind)
    );
  }

  private isPositionOnBaseNest(position: Vector2): boolean {
    return this.baseWallCells.some(cell =>
      rectanglesOverlap(
        position.x,
        position.y,
        POWER_UP_SIZE_WU,
        cell.x * CELL_SIZE_WU,
        cell.y * CELL_SIZE_WU,
        CELL_SIZE_WU
      )
    );
  }

  private isPositionOverTank(position: Vector2): boolean {
    return this.collectCollidableTanks().some(tank =>
      rectanglesOverlap(
        position.x,
        position.y,
        POWER_UP_SIZE_WU,
        tank.positionX,
        tank.positionY,
        TANK_SIZE_WU
      )
    );
  }

  private collectPowerUp(): void {
    const powerUp = this.powerUpDrop;

    if (isNil(powerUp)) {
      return;
    }

    const collector = this.playerTanks.find(
      player =>
        player.isActive &&
        rectanglesOverlap(
          powerUp.positionX,
          powerUp.positionY,
          POWER_UP_SIZE_WU,
          player.positionX,
          player.positionY,
          TANK_SIZE_WU
        )
    );

    if (isNil(collector)) {
      return;
    }

    this.powerUpDrop = undefined;
    this.events.push({
      type: 'power-up-taken',
      powerUpType: powerUp.type,
      playerSlot: collector.slot,
      position: {
        x: powerUp.positionX + POWER_UP_SIZE_WU / 2,
        y: powerUp.positionY + POWER_UP_SIZE_WU / 2,
      },
    });
    this.applyPowerUpEffect(powerUp.type, collector);
    this.addScore(POWER_UP_PICKUP_POINTS);
  }

  private applyPowerUpEffect(powerUpType: PowerUpType, collector: PlayerTank): void {
    const effect = getPowerUpEffect(powerUpType);

    switch (effect.kind) {
      case 'shield':
        collector.shieldTicksRemaining = effect.ticks;
        break;
      case 'freeze-enemies':
        this.freezeTicksRemaining = effect.ticks;
        break;
      case 'fortify-base':
        this.shovelTicksRemaining = effect.ticks;
        this.applyBaseWalls(getBaseWallMaterial(effect.ticks));
        break;
      case 'upgrade':
        collector.starLevel = upgradeStarLevel(collector.starLevel);
        break;
      case 'destroy-all-enemies':
        for (const enemy of [...this.enemyTanks]) {
          this.destroyEnemy(enemy, false);
        }
        break;
      case 'extra-life':
        this.livesValue++;
        break;
      default:
        assertNever(effect);
    }
  }

  private addScore(points: number): void {
    const previousScore = this.scoreValue;
    this.scoreValue += points;

    this.events.push({ type: 'score-awarded', points, totalScore: this.scoreValue });

    if (shouldAwardExtraLife(previousScore, this.scoreValue, this.isExtraLifeAwarded)) {
      this.isExtraLifeAwarded = true;
      this.livesValue++;
      this.events.push({ type: 'extra-life-awarded', totalLives: this.livesValue });
    }
  }

  private destroyBase(): void {
    if (this.isBaseDestroyedValue) {
      return;
    }

    this.isBaseDestroyedValue = true;
    this.events.push({ type: 'base-destroyed' });
    this.endGame();
  }

  private endGame(): void {
    if (this.statusValue === 'game-over') {
      return;
    }

    this.statusValue = 'game-over';
    this.events.push({ type: 'game-over' });
  }

  private updateStageCompletion(): void {
    if (this.spawner.hasPendingEnemies || this.enemyTanks.length > 0) {
      return;
    }

    this.statusValue = 'stage-cleared';
    this.events.push({ type: 'stage-cleared', stageNumber: this.stage.stageNumber });
  }

  private canFire(owner: TankRef, maxBullets: number): boolean {
    return countAliveBullets(this.aliveBullets, owner) < maxBullets;
  }

  private spawnBullet(owner: TankRef, tank: BulletShooter, traits: IBulletTraits): void {
    const bullet = createBullet({
      id: this.nextBulletId++,
      owner,
      direction: tank.direction,
      traits,
      tankPositionX: tank.positionX,
      tankPositionY: tank.positionY,
    });

    this.aliveBullets.push(bullet);
    this.events.push({
      type: 'bullet-fired',
      owner,
      position: { x: bullet.positionX, y: bullet.positionY },
    });
  }

  private collectCollidableTanks(): readonly TankBox[] {
    return [
      ...this.playerTanks.filter(player => player.isActive),
      ...this.enemyTanks.filter(enemy => enemy.twinkleTicksRemaining === 0),
    ];
  }

  private collectBulletTargets(): readonly IBulletTarget[] {
    return [
      ...this.playerTanks
        .filter(player => player.isActive)
        .map(player => ({
          ref: { side: 'player' as const, slot: player.slot },
          positionX: player.positionX,
          positionY: player.positionY,
        })),
      ...this.enemyTanks
        .filter(enemy => enemy.twinkleTicksRemaining === 0)
        .map(enemy => ({
          ref: { side: 'enemy' as const, slot: enemy.slot },
          positionX: enemy.positionX,
          positionY: enemy.positionY,
        })),
    ];
  }

  /** Already-overlapping tanks are not blockers — spawn-stacked tanks must be able to drive apart. */
  private createMovementContext(mover: TankBox): IMovementContext {
    const blockers = this.collectCollidableTanks().filter(
      tank =>
        tank !== mover &&
        !boxesOverlap(
          mover.positionX,
          mover.positionY,
          tank.positionX,
          tank.positionY,
          TANK_SIZE_WU
        )
    );

    return { terrain: this.terrainState, blockers };
  }

  private createAiContext(): IEnemyAiContext {
    return {
      ticksSinceStageStart: this.stageTicks,
      spawnIntervalTicks: this.spawnIntervalTicks,
      playerCenters: this.playerTanks.map(player =>
        player.isActive ? getTankCenter(player) : undefined
      ),
      baseCenter: getBaseCenter(this.baseCell),
    };
  }
}
