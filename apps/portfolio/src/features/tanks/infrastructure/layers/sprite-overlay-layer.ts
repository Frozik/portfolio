import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil, range } from 'lodash-es';

import { ENEMY_SPAWN_TWINKLE_TICKS, POWER_UP_SIZE_WU, TANK_SIZE_WU } from '../../domain/constants';
import type { EnemyTank, PlayerTank, PowerUpDrop } from '../../domain/types';
import { QuadBatch } from '../quad-batch';
import { QuadInstanceList } from '../quad-instances';
import type { QuadPipeline } from '../quad-pipeline';
import {
  MAX_OVERLAY_SPRITE_INSTANCES,
  POWER_UP_BLINK_TICKS,
  SCORE_POPUP_DIGIT_ADVANCE_WU,
  SHIELD_FRAME_TICKS,
  SPAWN_TWINKLE_FRAME_TICKS,
} from '../render-constants';
import type { ScorePopup, ScorePopupList } from '../score-popup-list';
import type { SpriteUvLookup } from '../sprite-atlas';
import { getBlinkPhase, ROTATION_TURNS_BY_DIRECTION, VISIBLE_BLINK_PHASE } from '../sprite-drawing';
import { DIGIT_HEIGHT_WU, DIGIT_WIDTH_WU } from '../sprites/digit-bitmaps';
import { SHIELD_FRAME_COUNT, SPAWN_TWINKLE_FRAME_COUNT } from '../sprites/effect-bitmaps';
import {
  getDigitSpriteId,
  getPowerUpSpriteId,
  getShieldSpriteId,
  getSpawnTwinkleSpriteId,
} from '../sprites/sprite-ids';
import type { ITanksWorldView } from '../tanks-world-view';

/** Ping-pongs large → small → large so a spawn reads as materialising, not spinning (§11.5). */
const SPAWN_TWINKLE_FRAME_SEQUENCE: readonly number[] = [
  ...range(SPAWN_TWINKLE_FRAME_COUNT - 1, -1, -1),
  ...range(1, SPAWN_TWINKLE_FRAME_COUNT),
];

const LAST_TWINKLE_STEP = SPAWN_TWINKLE_FRAME_SEQUENCE.length - 1;

const GLYPH_GAP_WU = SCORE_POPUP_DIGIT_ADVANCE_WU - DIGIT_WIDTH_WU;

/** Drawn after the forest: bonuses and state indicators must never hide behind the canopy (§11.3). */
export class SpriteOverlayLayer implements RenderLayer {
  private readonly batch: QuadBatch;
  private readonly instances = new QuadInstanceList(MAX_OVERLAY_SPRITE_INSTANCES);

  constructor(
    quadPipeline: QuadPipeline,
    private readonly atlas: SpriteUvLookup,
    private readonly view: ITanksWorldView,
    private readonly scorePopups: ScorePopupList
  ) {
    this.batch = new QuadBatch(quadPipeline);
  }

  init(): void {}

  update(): void {
    const tick = this.view.ticksSinceStageStart;

    this.instances.reset();

    for (const enemy of this.view.enemies) {
      this.pushSpawnTwinkle(enemy);
    }

    for (const player of this.view.players) {
      this.pushShield(player, tick);
    }

    this.pushPowerUp(this.view.powerUp, tick);

    for (const popup of this.scorePopups.items) {
      this.pushScorePopup(popup);
    }

    this.batch.upload(this.instances);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    this.batch.render(encoder, canvasView);
  }

  dispose(): void {
    this.batch.dispose();
  }

  private pushSpawnTwinkle(enemy: EnemyTank): void {
    if (enemy.twinkleTicksRemaining <= 0) {
      return;
    }

    const elapsedTicks = ENEMY_SPAWN_TWINKLE_TICKS - enemy.twinkleTicksRemaining;
    // The animation is shorter than the invulnerability window — hold the last step, don't re-pulse.
    const step = Math.min(Math.floor(elapsedTicks / SPAWN_TWINKLE_FRAME_TICKS), LAST_TWINKLE_STEP);

    this.pushTankSizedQuad(
      getSpawnTwinkleSpriteId(SPAWN_TWINKLE_FRAME_SEQUENCE[step]),
      enemy.positionX,
      enemy.positionY,
      ROTATION_TURNS_BY_DIRECTION[enemy.direction]
    );
  }

  private pushShield(player: PlayerTank, tick: number): void {
    if (!player.isActive || player.shieldTicksRemaining <= 0) {
      return;
    }

    const frameIndex = Math.floor(tick / SHIELD_FRAME_TICKS) % SHIELD_FRAME_COUNT;

    this.pushTankSizedQuad(
      getShieldSpriteId(frameIndex),
      player.positionX,
      player.positionY,
      ROTATION_TURNS_BY_DIRECTION[player.direction]
    );
  }

  private pushPowerUp(powerUp: PowerUpDrop | undefined, tick: number): void {
    if (isNil(powerUp) || getBlinkPhase(tick, POWER_UP_BLINK_TICKS) !== VISIBLE_BLINK_PHASE) {
      return;
    }

    this.instances.push({
      positionXWu: powerUp.positionX,
      positionYWu: powerUp.positionY,
      widthWu: POWER_UP_SIZE_WU,
      heightWu: POWER_UP_SIZE_WU,
      uvRect: this.atlas.getUvRect(getPowerUpSpriteId(powerUp.type)),
    });
  }

  /** Snapped to whole world units — a half-unit offset would blur the 3 × 5 glyphs (§11.1). */
  private pushScorePopup(popup: ScorePopup): void {
    const rowWidthWu = popup.digits.length * SCORE_POPUP_DIGIT_ADVANCE_WU - GLYPH_GAP_WU;
    const firstDigitXWu = Math.round(popup.centerXWu - rowWidthWu / 2);
    const digitYWu = Math.round(popup.centerYWu - DIGIT_HEIGHT_WU / 2);

    popup.digits.forEach((digit, digitIndex) => {
      this.instances.push({
        positionXWu: firstDigitXWu + digitIndex * SCORE_POPUP_DIGIT_ADVANCE_WU,
        positionYWu: digitYWu,
        widthWu: DIGIT_WIDTH_WU,
        heightWu: DIGIT_HEIGHT_WU,
        uvRect: this.atlas.getUvRect(getDigitSpriteId(digit)),
      });
    });
  }

  private pushTankSizedQuad(
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
}
