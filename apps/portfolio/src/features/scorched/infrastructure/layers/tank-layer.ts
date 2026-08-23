import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { clamp, isNil } from 'lodash-es';

import {
  COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED,
  MAX_TANK_HEALTH,
  SHIELD_CAPACITY_BY_TIER,
  TANK_CENTER_OFFSET_WU,
  TANK_HALF_WIDTH_WU,
  TICKS_PER_SECOND,
} from '../../domain/constants';
import type { PlayerId, ShieldState, TankState } from '../../domain/types';
import { getPlayerColor } from '../player-colors';
import {
  HEALTH_BAR_GAP_WU,
  HEALTH_BAR_HEIGHT_WU,
  HEALTH_BAR_OUTLINE_WU,
  MAX_TANK_SHAPE_INSTANCES,
  SHIELD_RING_RADIUS_WU,
  SHIELD_RING_THICKNESS_BY_TIER_WU,
} from '../render-constants';
import type { ScorchedRoundRef } from '../scorched-round-ref';
import { ShapeBatch } from '../shape-batch';
import { SHAPE_KIND, ShapeInstanceList } from '../shape-instances';
import type { ShapePipeline } from '../shape-pipeline';
import type { ITankBlueprint, RgbColor } from '../tank-art/tank-blueprint';
import { buildTankShapes, mixColor } from '../tank-art/tank-blueprint';
import { createTankBlueprint } from '../tank-art/tank-generator';

const HALF = 0.5;

const FULL_HEALTH_COLOR: RgbColor = { red: 0.3, green: 0.85, blue: 0.35 };
const HALF_HEALTH_COLOR: RgbColor = { red: 1, green: 0.62, blue: 0.12 };
const EMPTY_HEALTH_COLOR: RgbColor = { red: 0.92, green: 0.2, blue: 0.13 };
const HEALTH_BAR_OUTLINE_COLOR: RgbColor = { red: 0.04, green: 0.04, blue: 0.06 };

const SHIELD_RING_COLOR_BY_TIER: Readonly<Record<ShieldState['tier'], RgbColor>> = {
  shield: { red: 0.5, green: 0.85, blue: 1 },
  force: { red: 0.7, green: 0.6, blue: 1 },
  heavy: { red: 1, green: 0.75, blue: 0.3 },
};
const HALF_HEALTH_FRACTION = 0.5;
const MIN_FRACTION = 0;
const MAX_FRACTION = 1;

function toHealthBarColor(healthFraction: number): RgbColor {
  if (healthFraction >= HALF_HEALTH_FRACTION) {
    return mixColor(
      HALF_HEALTH_COLOR,
      FULL_HEALTH_COLOR,
      (healthFraction - HALF_HEALTH_FRACTION) / HALF_HEALTH_FRACTION
    );
  }

  return mixColor(EMPTY_HEALTH_COLOR, HALF_HEALTH_COLOR, healthFraction / HALF_HEALTH_FRACTION);
}

/** Where the tank is currently drawn, chasing where the domain put it. */
interface DrawnPosition {
  xWu: number;
  yWu: number;
  fallVelocityWuPerSecond: number;
}

/** The drawn tank chases the domain's position at this speed — one column in ~30 ms. */
const GLIDE_SPEED_WU_PER_SECOND = 32;
/** On top of that, this share of the remaining gap closes per second, so a lag never piles up. */
const GLIDE_CATCHUP_PER_SECOND = 8;
/** A jump this large is a respawn or a new round, not a drive — snap instead of gliding. */
const GLIDE_SNAP_DISTANCE_WU = 30;
/** The drawn fall matches the sand collapse's gravity, so the tank rides the dirt down. */
const FALL_GRAVITY_WU_PER_SECOND_SQUARED =
  COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED * TICKS_PER_SECOND * TICKS_PER_SECOND;
const FALL_TERMINAL_SPEED_WU_PER_SECOND = 120;

/**
 * [§11.3] The tanks, drawn from generated blueprints: a tracked chassis, a turret that turns
 * with the aim and a gun that tilts against it. Every player keeps their machine for the whole
 * session. The domain moves tanks a whole column at a time; the drawn tank chases it at a
 * steady speed, which is what fills the in-between frames without any easing kinks.
 */
export class TankLayer implements RenderLayer {
  private readonly instances = new ShapeInstanceList(MAX_TANK_SHAPE_INSTANCES);
  private readonly batch: ShapeBatch;
  private readonly blueprints = new Map<PlayerId, ITankBlueprint>();
  private readonly drawnPositions = new Map<PlayerId, DrawnPosition>();
  private frameDeltaSeconds = 0;
  private previousFrameSeconds: number | undefined;

  constructor(
    shapePipeline: ShapePipeline,
    private readonly roundRef: ScorchedRoundRef
  ) {
    this.batch = new ShapeBatch(shapePipeline, MAX_TANK_SHAPE_INSTANCES);
  }

  init(): void {}

  update(state: FrameState): void {
    this.frameDeltaSeconds = isNil(this.previousFrameSeconds)
      ? 0
      : Math.max(0, state.time - this.previousFrameSeconds);
    this.previousFrameSeconds = state.time;
    this.instances.reset();

    for (const tank of this.roundRef.current.tanks) {
      if (tank.isAlive) {
        this.pushTank(tank);
      }
    }

    this.batch.upload(this.instances);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    this.batch.render(encoder, canvasView);
  }

  dispose(): void {
    this.batch.dispose();
  }

  private getBlueprint(playerId: PlayerId): ITankBlueprint {
    const existing = this.blueprints.get(playerId);

    if (!isNil(existing)) {
      return existing;
    }

    const created = createTankBlueprint();

    this.blueprints.set(playerId, created);

    return created;
  }

  private getGlidePosition(tank: TankState): DrawnPosition {
    const targetX = tank.columnIndex + HALF;
    const targetY = tank.positionY;
    const drawn = this.drawnPositions.get(tank.playerId);

    if (drawn === undefined) {
      const snapped: DrawnPosition = { xWu: targetX, yWu: targetY, fallVelocityWuPerSecond: 0 };

      this.drawnPositions.set(tank.playerId, snapped);

      return snapped;
    }

    const gapX = targetX - drawn.xWu;
    const gapY = targetY - drawn.yWu;
    const gap = Math.hypot(gapX, gapY);

    if (gap === 0) {
      drawn.fallVelocityWuPerSecond = 0;

      return drawn;
    }

    // A straight-down drop is the ground giving way, not a drive: fall with the sand, however far.
    if (gapX === 0 && gapY < 0) {
      drawn.fallVelocityWuPerSecond = Math.min(
        FALL_TERMINAL_SPEED_WU_PER_SECOND,
        drawn.fallVelocityWuPerSecond + FALL_GRAVITY_WU_PER_SECOND_SQUARED * this.frameDeltaSeconds
      );
      drawn.yWu = Math.max(
        targetY,
        drawn.yWu - drawn.fallVelocityWuPerSecond * this.frameDeltaSeconds
      );

      return drawn;
    }

    drawn.fallVelocityWuPerSecond = 0;

    const speed = GLIDE_SPEED_WU_PER_SECOND + gap * GLIDE_CATCHUP_PER_SECOND;
    const stepWu = Math.min(gap, speed * this.frameDeltaSeconds);

    if (gap >= GLIDE_SNAP_DISTANCE_WU) {
      drawn.xWu = targetX;
      drawn.yWu = targetY;
    } else {
      drawn.xWu += (gapX / gap) * stepWu;
      drawn.yWu += (gapY / gap) * stepWu;
    }

    return drawn;
  }

  private pushTank(tank: TankState): void {
    const drawn = this.getGlidePosition(tank);
    const shapes = buildTankShapes(this.getBlueprint(tank.playerId), {
      centerXWu: drawn.xWu,
      baseYWu: drawn.yWu,
      aim: tank.aim,
      color: getPlayerColor(tank.playerId),
    });

    for (const shape of shapes) {
      this.instances.push(shape);
    }

    this.pushHealthBar(tank, drawn.xWu, drawn.yWu);

    if (!isNil(tank.shield)) {
      this.pushShieldRing(tank.shield, drawn.xWu, drawn.yWu + TANK_CENTER_OFFSET_WU);
    }
  }

  /** The ring's brightness is the shield's remaining energy: full charge glows, empty is gone. */
  private pushShieldRing(shield: ShieldState, centerX: number, centerY: number): void {
    const capacity = SHIELD_CAPACITY_BY_TIER[shield.tier];
    const color = SHIELD_RING_COLOR_BY_TIER[shield.tier];

    this.instances.push({
      centerXWu: centerX,
      centerYWu: centerY,
      halfWidthWu: SHIELD_RING_RADIUS_WU,
      halfHeightWu: SHIELD_RING_RADIUS_WU,
      kind: SHAPE_KIND.ring,
      innerRadiusFraction:
        1 - SHIELD_RING_THICKNESS_BY_TIER_WU[shield.tier] / SHIELD_RING_RADIUS_WU,
      red: color.red,
      green: color.green,
      blue: color.blue,
      alpha: clamp(shield.remaining / capacity, MIN_FRACTION, MAX_FRACTION),
    });
  }

  /** The dark outline doubles as the depleted part of the track. */
  private pushHealthBar(tank: TankState, centerX: number, baseYWu: number): void {
    const healthFraction = clamp(tank.health / MAX_TANK_HEALTH, MIN_FRACTION, MAX_FRACTION);
    const fillColor = toHealthBarColor(healthFraction);
    const barCenterY = baseYWu - HEALTH_BAR_GAP_WU - HEALTH_BAR_HEIGHT_WU * HALF;
    const fillHalfWidth = TANK_HALF_WIDTH_WU * healthFraction;

    this.instances.push({
      centerXWu: centerX,
      centerYWu: barCenterY,
      halfWidthWu: TANK_HALF_WIDTH_WU + HEALTH_BAR_OUTLINE_WU,
      halfHeightWu: HEALTH_BAR_HEIGHT_WU * HALF + HEALTH_BAR_OUTLINE_WU,
      red: HEALTH_BAR_OUTLINE_COLOR.red,
      green: HEALTH_BAR_OUTLINE_COLOR.green,
      blue: HEALTH_BAR_OUTLINE_COLOR.blue,
    });

    this.instances.push({
      centerXWu: centerX - TANK_HALF_WIDTH_WU + fillHalfWidth,
      centerYWu: barCenterY,
      halfWidthWu: fillHalfWidth,
      halfHeightWu: HEALTH_BAR_HEIGHT_WU * HALF,
      red: fillColor.red,
      green: fillColor.green,
      blue: fillColor.blue,
    });
  }
}
