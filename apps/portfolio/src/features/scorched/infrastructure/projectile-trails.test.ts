import { describe, expect, it } from 'vitest';

import type { Projectile } from '../domain/types';
import { toPlayerId } from '../domain/types';
import { ProjectileTrails } from './projectile-trails';
import {
  TRACE_DOT_SPACING_WU,
  TRACE_PATH_LENGTH,
  TRACE_TELEPORT_DISTANCE_WU,
} from './render-constants';

function createProjectile(id: number, positionX: number, positionY: number): Projectile {
  return {
    id,
    ownerId: toPlayerId(0),
    weaponId: 'baby-missile',
    shotId: 1,
    hasContactTrigger: false,
    guidance: undefined,
    guidanceTarget: undefined,
    blastRadiusWu: 10,
    stageIndex: 0,
    state: { position: { x: positionX, y: positionY }, velocity: { x: 1, y: 1 } },
    rolling: undefined,
    pouring: undefined,
    hasPassedApex: false,
    hasClearedOwner: true,
    isMagDeflected: false,
    ticksAlive: 1,
  };
}

describe('ProjectileTrails', () => {
  it('drops dots evenly by distance flown, not one per sample', () => {
    const trails = new ProjectileTrails();

    trails.sample([createProjectile(1, 0, 0)]);
    trails.sample([createProjectile(1, TRACE_DOT_SPACING_WU * 2, 0)]);

    expect(trails.getPath(1)).toEqual([
      { x: 0, y: 0 },
      { x: TRACE_DOT_SPACING_WU, y: 0 },
      { x: TRACE_DOT_SPACING_WU * 2, y: 0 },
    ]);
  });

  it('carries the leftover distance across samples', () => {
    const trails = new ProjectileTrails();
    const halfSpacing = TRACE_DOT_SPACING_WU / 2;

    trails.sample([createProjectile(1, 0, 0)]);
    trails.sample([createProjectile(1, halfSpacing, 0)]);

    expect(trails.getPath(1)).toHaveLength(1);

    trails.sample([createProjectile(1, halfSpacing * 2, 0)]);

    expect(trails.getPath(1)).toEqual([
      { x: 0, y: 0 },
      { x: TRACE_DOT_SPACING_WU, y: 0 },
    ]);
  });

  it('ignores a frame that found the shell where it already was', () => {
    const trails = new ProjectileTrails();

    trails.sample([createProjectile(1, 10, 20)]);
    trails.sample([createProjectile(1, 10, 20)]);

    expect(trails.getPath(1)).toHaveLength(1);
  });

  it('keeps only the most recent stretch of the path', () => {
    const trails = new ProjectileTrails();

    for (let step = 0; step <= TRACE_PATH_LENGTH + 1; step++) {
      trails.sample([createProjectile(1, step * TRACE_DOT_SPACING_WU, 0)]);
    }

    const path = trails.getPath(1) ?? [];

    expect(path).toHaveLength(TRACE_PATH_LENGTH);
    expect(path[0]).toEqual({ x: TRACE_DOT_SPACING_WU * 2, y: 0 });
  });

  it('does not bridge a wall wrap with dots', () => {
    const trails = new ProjectileTrails();

    trails.sample([createProjectile(1, 0, 0)]);
    trails.sample([createProjectile(1, TRACE_TELEPORT_DISTANCE_WU * 2, 0)]);

    expect(trails.getPath(1)).toHaveLength(1);
  });

  it('forgets a shell once it has detonated', () => {
    const trails = new ProjectileTrails();

    trails.sample([createProjectile(1, 10, 20), createProjectile(2, 30, 40)]);
    trails.sample([createProjectile(2, 31, 41)]);

    expect(trails.getPath(1)).toBeUndefined();
    expect(trails.getPath(2)).toBeDefined();
  });
});
