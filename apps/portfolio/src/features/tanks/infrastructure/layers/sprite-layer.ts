import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import { BULLET_SIZE_WU, ENEMY_HIT_POINTS_BY_TYPE, TANK_SIZE_WU } from '../../domain/constants';
import type { Bullet, EnemyTank, PlayerTank } from '../../domain/types';
import type { ActiveEffect, EffectList } from '../effect-list';
import { getEffectFrame } from '../effect-list';
import { QuadBatch } from '../quad-batch';
import { QuadInstanceList } from '../quad-instances';
import type { QuadPipeline } from '../quad-pipeline';
import { CARRIER_FLASH_TICKS, MAX_SPRITE_INSTANCES } from '../render-constants';
import type { SpriteUvLookup } from '../sprite-atlas';
import {
  FLASHING_BLINK_PHASE,
  getBlinkPhase,
  ROTATION_TURNS_BY_DIRECTION,
} from '../sprite-drawing';
import { resolveEnemyPaletteName } from '../sprites/palettes';
import {
  BULLET_SPRITE_ID,
  getEnemyTankSpriteId,
  getPlayerTankSpriteId,
} from '../sprites/sprite-ids';
import { TankTrackAnimator } from '../tank-track-animator';
import type { ITanksWorldView } from '../tanks-world-view';

/** Drawn between ground and forest, so trees conceal whatever drives under them. */
export class SpriteLayer implements RenderLayer {
  private readonly batch: QuadBatch;
  private readonly instances = new QuadInstanceList(MAX_SPRITE_INSTANCES);
  private readonly trackAnimator = new TankTrackAnimator();

  constructor(
    quadPipeline: QuadPipeline,
    private readonly atlas: SpriteUvLookup,
    private readonly view: ITanksWorldView,
    private readonly effects: EffectList
  ) {
    this.batch = new QuadBatch(quadPipeline);
  }

  init(): void {}

  update(): void {
    const tick = this.view.ticksSinceStageStart;

    this.instances.reset();

    for (const player of this.view.players) {
      this.pushPlayer(player);
    }

    for (const enemy of this.view.enemies) {
      this.pushEnemy(enemy, tick);
    }

    for (const bullet of this.view.bullets) {
      this.pushBullet(bullet);
    }

    for (const effect of this.effects.items) {
      this.pushEffect(effect);
    }

    this.batch.upload(this.instances);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    this.batch.render(encoder, canvasView);
  }

  dispose(): void {
    this.batch.dispose();
  }

  private pushPlayer(player: PlayerTank): void {
    if (!player.isActive) {
      return;
    }

    const frameIndex = this.trackAnimator.resolveFrameIndex(
      `player-${player.slot}`,
      player.positionX,
      player.positionY
    );

    this.pushTank(
      getPlayerTankSpriteId(player.slot, player.starLevel, frameIndex),
      player.positionX,
      player.positionY,
      ROTATION_TURNS_BY_DIRECTION[player.direction]
    );
  }

  /** A twinkling enemy has no body yet — `SpriteOverlayLayer` draws its spawn animation. */
  private pushEnemy(enemy: EnemyTank, tick: number): void {
    if (enemy.twinkleTicksRemaining > 0) {
      return;
    }

    const frameIndex = this.trackAnimator.resolveFrameIndex(
      `enemy-${enemy.slot}`,
      enemy.positionX,
      enemy.positionY
    );
    const paletteName = resolveEnemyPaletteName({
      enemyType: enemy.type,
      damageLevel: ENEMY_HIT_POINTS_BY_TYPE[enemy.type] - enemy.hitPoints,
      isCarrierFlashing:
        enemy.isPowerUpCarrier && getBlinkPhase(tick, CARRIER_FLASH_TICKS) === FLASHING_BLINK_PHASE,
      tick,
    });

    this.pushTank(
      getEnemyTankSpriteId(enemy.type, paletteName, frameIndex),
      enemy.positionX,
      enemy.positionY,
      ROTATION_TURNS_BY_DIRECTION[enemy.direction]
    );
  }

  private pushTank(
    spriteId: string,
    positionXWu: number,
    positionYWu: number,
    rotationTurns: number
  ): void {
    this.instances.push({
      positionXWu,
      positionYWu,
      widthWu: TANK_SIZE_WU,
      heightWu: TANK_SIZE_WU,
      uvRect: this.atlas.getUvRect(spriteId),
      rotationTurns,
    });
  }

  private pushBullet(bullet: Bullet): void {
    this.instances.push({
      positionXWu: bullet.positionX,
      positionYWu: bullet.positionY,
      widthWu: BULLET_SIZE_WU,
      heightWu: BULLET_SIZE_WU,
      uvRect: this.atlas.getUvRect(BULLET_SPRITE_ID),
      rotationTurns: ROTATION_TURNS_BY_DIRECTION[bullet.direction],
    });
  }

  /** Effects are anchored to the centre of whatever died; quads are placed by their corner. */
  private pushEffect(effect: ActiveEffect): void {
    const { spriteId, sizeWu } = getEffectFrame(effect);

    this.instances.push({
      positionXWu: effect.centerXWu - sizeWu / 2,
      positionYWu: effect.centerYWu - sizeWu / 2,
      widthWu: sizeWu,
      heightWu: sizeWu,
      uvRect: this.atlas.getUvRect(spriteId),
    });
  }
}
