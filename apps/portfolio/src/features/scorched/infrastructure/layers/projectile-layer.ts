import type { Vector2 } from '@frozik/utils/math/vector2';
import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import type { Projectile } from '../../domain/types';
import { getPlayerColor } from '../../presentation/player-colors';
import type { ProjectileTrails } from '../projectile-trails';
import {
  CONTRAIL_OLD_HALF_WIDTH_WU,
  CONTRAIL_YOUNG_HALF_WIDTH_WU,
  MAX_PROJECTILE_SHAPE_INSTANCES,
  SHELL_HALF_LENGTH_WU,
  SHELL_RADIUS_WU,
} from '../render-constants';
import type { ScorchedRoundRef } from '../scorched-round-ref';
import { ShapeBatch } from '../shape-batch';
import { SHAPE_KIND, ShapeInstanceList } from '../shape-instances';
import type { ShapePipeline } from '../shape-pipeline';
import type { RgbColor } from '../tank-art/tank-blueprint';

/** The contrail is white and translucent, brightest right behind the shell. */
const CONTRAIL_COLOR: RgbColor = { red: 1, green: 1, blue: 1 };
const CONTRAIL_YOUNG_ALPHA = 0.3;
const CONTRAIL_OLD_ALPHA = 0.02;
/** Segments overlap a touch so the ribbon reads as one streak rather than a chain. */
const CONTRAIL_SEGMENT_OVERLAP_WU = 0.5;

const SHELL_OUTLINE_WU = 0.5;
const SHELL_OUTLINE_COLOR: RgbColor = { red: 0.07, green: 0.08, blue: 0.14 };

/** A landed roller crawls as a low green mine dome with a small red trigger button on top. */
const MINE_DOME_HALF_WIDTH_WU = 2.8;
const MINE_DOME_HALF_HEIGHT_WU = 1.6;
const MINE_BODY_COLOR: RgbColor = { red: 0.38, green: 0.76, blue: 0.22 };
const MINE_HIGHLIGHT_COLOR: RgbColor = { red: 0.78, green: 0.93, blue: 0.55 };
const MINE_HIGHLIGHT_OFFSET_FRACTION = 0.35;
const MINE_HIGHLIGHT_RAISE_FRACTION = 0.55;
const MINE_HIGHLIGHT_WIDTH_FRACTION = 0.3;
const MINE_HIGHLIGHT_HEIGHT_FRACTION = 0.22;
const MINE_CAP_HALF_WIDTH_WU = 1;
const MINE_CAP_HALF_HEIGHT_WU = 0.45;
const MINE_CAP_RING_WU = 0.35;
const MINE_CAP_COLOR: RgbColor = { red: 0.95, green: 0.12, blue: 0.1 };
const MINE_CAP_RING_COLOR: RgbColor = { red: 0.45, green: 0.03, blue: 0.05 };

/**
 * [§11.2] Shells and the contrail they leave behind — a light white streak dispersing with age,
 * the way an aircraft's does. Positions come straight from the domain — the renderer never
 * integrates a trajectory of its own.
 */
export class ProjectileLayer implements RenderLayer {
  private readonly instances = new ShapeInstanceList(MAX_PROJECTILE_SHAPE_INSTANCES);
  private readonly batch: ShapeBatch;

  constructor(
    shapePipeline: ShapePipeline,
    private readonly roundRef: ScorchedRoundRef,
    private readonly trails: ProjectileTrails
  ) {
    this.batch = new ShapeBatch(shapePipeline, MAX_PROJECTILE_SHAPE_INSTANCES);
  }

  init(): void {}

  update(): void {
    const { projectiles } = this.roundRef.current;

    this.trails.sample(projectiles);
    this.instances.reset();

    for (const projectile of projectiles) {
      this.pushContrail(projectile);
    }

    for (const projectile of projectiles) {
      this.pushShell(projectile);
    }

    this.batch.upload(this.instances);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    this.batch.render(encoder, canvasView);
  }

  dispose(): void {
    this.batch.dispose();
  }

  private pushShell(projectile: Projectile): void {
    if (projectile.rolling !== undefined) {
      this.pushMine(projectile);

      return;
    }

    const { position, velocity } = projectile.state;
    const angle = Math.atan2(velocity.y, velocity.x);
    const noseX = position.x + Math.cos(angle) * SHELL_HALF_LENGTH_WU;
    const noseY = position.y + Math.sin(angle) * SHELL_HALF_LENGTH_WU;
    const color = getPlayerColor(projectile.ownerId);
    const body = {
      centerXWu: position.x,
      centerYWu: position.y,
      halfWidthWu: SHELL_HALF_LENGTH_WU,
      halfHeightWu: SHELL_RADIUS_WU,
      rotationRadians: angle,
    };
    const nose = {
      centerXWu: noseX,
      centerYWu: noseY,
      halfWidthWu: SHELL_RADIUS_WU,
      halfHeightWu: SHELL_RADIUS_WU,
      kind: SHAPE_KIND.ellipse,
    };

    for (const shape of [body, nose]) {
      this.pushIfRoom({
        ...shape,
        halfWidthWu: shape.halfWidthWu + SHELL_OUTLINE_WU,
        halfHeightWu: shape.halfHeightWu + SHELL_OUTLINE_WU,
        red: SHELL_OUTLINE_COLOR.red,
        green: SHELL_OUTLINE_COLOR.green,
        blue: SHELL_OUTLINE_COLOR.blue,
      });
    }

    for (const shape of [body, nose]) {
      this.pushIfRoom({ ...shape, red: color.red, green: color.green, blue: color.blue });
    }
  }

  /** The green mine dome and its red button, sitting into the surface where the shell landed. */
  private pushMine(projectile: Projectile): void {
    const { position } = projectile.state;
    const dome = {
      centerXWu: position.x,
      centerYWu: position.y + MINE_DOME_HALF_HEIGHT_WU / 2,
      halfWidthWu: MINE_DOME_HALF_WIDTH_WU,
      halfHeightWu: MINE_DOME_HALF_HEIGHT_WU,
      kind: SHAPE_KIND.ellipse,
    };
    const capCenterYWu = position.y + MINE_DOME_HALF_HEIGHT_WU + MINE_CAP_HALF_HEIGHT_WU / 2;

    this.pushIfRoom({
      ...dome,
      halfWidthWu: dome.halfWidthWu + SHELL_OUTLINE_WU,
      halfHeightWu: dome.halfHeightWu + SHELL_OUTLINE_WU,
      red: SHELL_OUTLINE_COLOR.red,
      green: SHELL_OUTLINE_COLOR.green,
      blue: SHELL_OUTLINE_COLOR.blue,
    });
    this.pushIfRoom({
      ...dome,
      red: MINE_BODY_COLOR.red,
      green: MINE_BODY_COLOR.green,
      blue: MINE_BODY_COLOR.blue,
    });
    this.pushIfRoom({
      centerXWu: position.x - MINE_DOME_HALF_WIDTH_WU * MINE_HIGHLIGHT_OFFSET_FRACTION,
      centerYWu: position.y + MINE_DOME_HALF_HEIGHT_WU * MINE_HIGHLIGHT_RAISE_FRACTION,
      halfWidthWu: MINE_DOME_HALF_WIDTH_WU * MINE_HIGHLIGHT_WIDTH_FRACTION,
      halfHeightWu: MINE_DOME_HALF_HEIGHT_WU * MINE_HIGHLIGHT_HEIGHT_FRACTION,
      kind: SHAPE_KIND.ellipse,
      red: MINE_HIGHLIGHT_COLOR.red,
      green: MINE_HIGHLIGHT_COLOR.green,
      blue: MINE_HIGHLIGHT_COLOR.blue,
    });
    this.pushIfRoom({
      centerXWu: position.x,
      centerYWu: capCenterYWu,
      halfWidthWu: MINE_CAP_HALF_WIDTH_WU + MINE_CAP_RING_WU,
      halfHeightWu: MINE_CAP_HALF_HEIGHT_WU + MINE_CAP_RING_WU,
      kind: SHAPE_KIND.ellipse,
      red: MINE_CAP_RING_COLOR.red,
      green: MINE_CAP_RING_COLOR.green,
      blue: MINE_CAP_RING_COLOR.blue,
    });
    this.pushIfRoom({
      centerXWu: position.x,
      centerYWu: capCenterYWu,
      halfWidthWu: MINE_CAP_HALF_WIDTH_WU,
      halfHeightWu: MINE_CAP_HALF_HEIGHT_WU,
      kind: SHAPE_KIND.ellipse,
      red: MINE_CAP_COLOR.red,
      green: MINE_CAP_COLOR.green,
      blue: MINE_CAP_COLOR.blue,
    });
  }

  private pushContrail(projectile: Projectile): void {
    const path = this.trails.getPath(projectile.id) ?? [];
    const segmentCount = path.length;

    for (let index = 0; index < segmentCount; index++) {
      // The newest segment runs from the last sample to the shell itself, keeping the streak
      // attached to it between samples. A crawling mine leaves no contrail: its streak ends
      // where the shell touched down.
      const start = path[index];
      const isNewestSegment = index + 1 >= segmentCount;

      if (isNewestSegment && projectile.rolling !== undefined) {
        break;
      }

      const end = isNewestSegment ? projectile.state.position : path[index + 1];

      this.pushContrailSegment(start, end, (index + 1) / segmentCount);
    }
  }

  private pushContrailSegment(start: Vector2, end: Vector2, youthFraction: number): void {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);

    if (length === 0) {
      return;
    }

    this.pushIfRoom({
      centerXWu: (start.x + end.x) / 2,
      centerYWu: (start.y + end.y) / 2,
      halfWidthWu: length / 2 + CONTRAIL_SEGMENT_OVERLAP_WU,
      halfHeightWu:
        CONTRAIL_OLD_HALF_WIDTH_WU +
        (CONTRAIL_YOUNG_HALF_WIDTH_WU - CONTRAIL_OLD_HALF_WIDTH_WU) * youthFraction,
      rotationRadians: Math.atan2(deltaY, deltaX),
      alpha: CONTRAIL_OLD_ALPHA + (CONTRAIL_YOUNG_ALPHA - CONTRAIL_OLD_ALPHA) * youthFraction,
      red: CONTRAIL_COLOR.red,
      green: CONTRAIL_COLOR.green,
      blue: CONTRAIL_COLOR.blue,
    });
  }

  private pushIfRoom(instance: Parameters<ShapeInstanceList['push']>[0]): void {
    if (this.instances.hasRoom) {
      this.instances.push(instance);
    }
  }
}
