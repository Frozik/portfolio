import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Projectile } from '../domain/types';
import {
  TRACE_DOT_SPACING_WU,
  TRACE_PATH_LENGTH,
  TRACE_TELEPORT_DISTANCE_WU,
} from './render-constants';

interface TrailState {
  readonly dots: Vector2[];
  lastPosition: Vector2;
  /** How much further the shell must fly before the next dot is dropped. */
  distanceToNextDotWu: number;
}

/**
 * The dotted path a shell leaves behind it (the Trace Paths option). Dots are dropped
 * every `TRACE_DOT_SPACING_WU` of distance flown — interpolated inside a tick's step — so the
 * dotting stays even along the curve instead of bunching where the shell flies slowly.
 */
export class ProjectileTrails {
  private readonly trailsByProjectileId = new Map<number, TrailState>();

  getPath(projectileId: number): readonly Vector2[] | undefined {
    return this.trailsByProjectileId.get(projectileId)?.dots;
  }

  sample(projectiles: readonly Projectile[]): void {
    for (const projectile of projectiles) {
      // A landed roller crawls as a mine and leaves no contrail — its path ends at touchdown.
      if (projectile.rolling === undefined) {
        this.advanceTrail(projectile.id, projectile.state.position);
      }
    }

    this.forgetEndedShells(projectiles);
  }

  clear(): void {
    this.trailsByProjectileId.clear();
  }

  private advanceTrail(projectileId: number, position: Vector2): void {
    const trail = this.trailsByProjectileId.get(projectileId);

    if (trail === undefined) {
      this.trailsByProjectileId.set(projectileId, {
        dots: [{ ...position }],
        lastPosition: { ...position },
        distanceToNextDotWu: TRACE_DOT_SPACING_WU,
      });

      return;
    }

    const stepX = position.x - trail.lastPosition.x;
    const stepY = position.y - trail.lastPosition.y;
    const stepLength = Math.hypot(stepX, stepY);

    if (stepLength === 0) {
      return;
    }

    if (stepLength >= TRACE_TELEPORT_DISTANCE_WU) {
      trail.lastPosition = { ...position };
      trail.distanceToNextDotWu = TRACE_DOT_SPACING_WU;

      return;
    }

    const directionX = stepX / stepLength;
    const directionY = stepY / stepLength;
    let travelled = 0;

    while (stepLength - travelled >= trail.distanceToNextDotWu) {
      travelled += trail.distanceToNextDotWu;
      trail.distanceToNextDotWu = TRACE_DOT_SPACING_WU;
      trail.dots.push({
        x: trail.lastPosition.x + directionX * travelled,
        y: trail.lastPosition.y + directionY * travelled,
      });

      if (trail.dots.length > TRACE_PATH_LENGTH) {
        trail.dots.shift();
      }
    }

    trail.distanceToNextDotWu -= stepLength - travelled;
    trail.lastPosition = { ...position };
  }

  private forgetEndedShells(projectiles: readonly Projectile[]): void {
    for (const projectileId of this.trailsByProjectileId.keys()) {
      if (!projectiles.some(projectile => projectile.id === projectileId)) {
        this.trailsByProjectileId.delete(projectileId);
      }
    }
  }
}
