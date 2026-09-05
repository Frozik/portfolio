import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import type { AimGhost } from '../../application/aim-ghost';
import { createEnvironment, getLaunchOrigin } from '../../domain/ballistics';
import { LASER_BEAM_HALF_WIDTH_WU } from '../../domain/constants';
import { getPlayerColor } from '../../presentation/player-colors';
import { sampleGhostTrajectory } from '../ghost-trajectory';
import type { LaserBeamList } from '../laser-beams';
import {
  GHOST_DOT_RADIUS_WU,
  MAX_OVERLAY_SHAPE_INSTANCES,
  RETREAT_BODY_HALF_HEIGHT_WU,
  RETREAT_BODY_HALF_WIDTH_WU,
  RETREAT_CLIMB_WU,
  RETREAT_ROTOR_HALF_HEIGHT_WU,
  RETREAT_ROTOR_HALF_WIDTH_WU,
  RETREAT_ROTOR_OFFSET_WU,
  RETREAT_ROTOR_SPIN_HZ,
} from '../render-constants';
import type { RetreatFlightList } from '../retreat-flights';
import type { ScorchedRoundRef } from '../scorched-round-ref';
import { ShapeBatch } from '../shape-batch';
import { SHAPE_KIND, ShapeInstanceList } from '../shape-instances';
import type { ShapePipeline } from '../shape-pipeline';

const HALF = 0.5;
const FULL = 1;
const TAU = Math.PI * 2;
/** The mast joining the rotor to the body — a sliver of the body's own width. */
const RETREAT_MAST_HALF_WIDTH_WU = 1;

/**
 * The things drawn over the field that are not simulation state: the dotted aim
 * ghost the player is dragging out, the laser beam of a shot that has already resolved, and the
 * helicopter carrying a retreating tank off the top of the screen.
 */
export class OverlayLayer implements RenderLayer {
  private readonly instances = new ShapeInstanceList(MAX_OVERLAY_SHAPE_INSTANCES);
  private readonly batch: ShapeBatch;
  private previousTimeSeconds: number | undefined;

  constructor(
    shapePipeline: ShapePipeline,
    private readonly roundRef: ScorchedRoundRef,
    private readonly ghost: AimGhost,
    private readonly beams: LaserBeamList,
    private readonly retreats: RetreatFlightList
  ) {
    this.batch = new ShapeBatch(shapePipeline, MAX_OVERLAY_SHAPE_INSTANCES);
  }

  init(): void {}

  update(state: FrameState): void {
    const previousTimeSeconds = this.previousTimeSeconds;
    const elapsedSeconds = isNil(previousTimeSeconds) ? 0 : state.time - previousTimeSeconds;

    this.previousTimeSeconds = state.time;
    this.beams.fade(elapsedSeconds);
    this.retreats.advance(elapsedSeconds);
    this.instances.reset();
    this.pushGhost();
    this.pushBeams();
    this.pushRetreats(state.time);
    this.batch.upload(this.instances);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    this.batch.render(encoder, canvasView);
  }

  dispose(): void {
    this.batch.dispose();
  }

  private pushGhost(): void {
    const round = this.roundRef.current;
    const activePlayerId = round.activePlayerId;

    if (!this.ghost.isVisible || round.phase !== 'aiming' || isNil(activePlayerId)) {
      return;
    }

    const tank = round.getTank(activePlayerId);

    if (isNil(tank)) {
      return;
    }

    const color = getPlayerColor(activePlayerId);
    const samples = sampleGhostTrajectory({
      origin: getLaunchOrigin(tank.columnIndex + HALF, tank.positionY, tank.aim),
      aim: tank.aim,
      environment: createEnvironment(
        round.physics,
        round.windUnits,
        round.resolvedWallMode,
        round.field.length
      ),
      field: round.field,
    });

    for (const sample of samples) {
      if (!this.instances.hasRoom) {
        return;
      }

      this.instances.push({
        centerXWu: sample.position.x,
        centerYWu: sample.position.y,
        halfWidthWu: GHOST_DOT_RADIUS_WU,
        halfHeightWu: GHOST_DOT_RADIUS_WU,
        kind: SHAPE_KIND.ellipse,
        alpha: sample.alpha,
        red: color.red,
        green: color.green,
        blue: color.blue,
      });
    }
  }

  private pushBeams(): void {
    for (const beam of this.beams.current) {
      if (!this.instances.hasRoom) {
        return;
      }

      const spanX = beam.to.x - beam.from.x;
      const spanY = beam.to.y - beam.from.y;
      const color = getPlayerColor(beam.ownerId);

      this.instances.push({
        centerXWu: beam.from.x + spanX * HALF,
        centerYWu: beam.from.y + spanY * HALF,
        halfWidthWu: Math.hypot(spanX, spanY) * HALF,
        halfHeightWu: LASER_BEAM_HALF_WIDTH_WU * HALF,
        rotationRadians: Math.atan2(spanY, spanX),
        alpha: beam.remainingFraction,
        red: color.red,
        green: color.green,
        blue: color.blue,
      });
    }
  }

  /**
   * [MANUAL §8] The helicopter: a body, a mast and a rotor bar whose width oscillates so it reads
   * as spinning without a second pipeline. It climbs off the top of the field and fades as it goes.
   */
  private pushRetreats(timeSeconds: number): void {
    for (const flight of this.retreats.current) {
      if (!this.instances.hasRoom) {
        return;
      }

      const color = getPlayerColor(flight.playerId);
      const centerY = flight.origin.y + RETREAT_CLIMB_WU * flight.progress;
      const alpha = FULL - flight.progress;
      const spin = Math.abs(Math.cos(TAU * RETREAT_ROTOR_SPIN_HZ * timeSeconds));

      this.instances.push({
        centerXWu: flight.origin.x,
        centerYWu: centerY,
        halfWidthWu: RETREAT_BODY_HALF_WIDTH_WU,
        halfHeightWu: RETREAT_BODY_HALF_HEIGHT_WU,
        alpha,
        red: color.red,
        green: color.green,
        blue: color.blue,
      });
      this.instances.push({
        centerXWu: flight.origin.x,
        centerYWu: centerY + RETREAT_ROTOR_OFFSET_WU * HALF,
        halfWidthWu: RETREAT_MAST_HALF_WIDTH_WU,
        halfHeightWu: RETREAT_ROTOR_OFFSET_WU * HALF,
        alpha,
        red: color.red,
        green: color.green,
        blue: color.blue,
      });
      this.instances.push({
        centerXWu: flight.origin.x,
        centerYWu: centerY + RETREAT_ROTOR_OFFSET_WU,
        halfWidthWu: RETREAT_ROTOR_HALF_WIDTH_WU * spin,
        halfHeightWu: RETREAT_ROTOR_HALF_HEIGHT_WU,
        alpha,
        red: color.red,
        green: color.green,
        blue: color.blue,
      });
    }
  }
}
