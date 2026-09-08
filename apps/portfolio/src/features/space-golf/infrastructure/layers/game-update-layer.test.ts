import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import { describe, expect, it, vi } from 'vitest';

import { createBall, respawn } from '../../domain/ball';
import { createTestLevel } from '../../domain/test-level';
import type { SceneFrame } from '../render/scene-frame';
import { createGameUpdateLayer } from './game-update-layer';

const FRAME = { canvasWidth: 900, canvasHeight: 1600, devicePixelRatio: 1 };

function createLayer(scene: () => SceneFrame | undefined) {
  const markDirty = vi.fn();
  const raise = vi.fn();
  const layer = createGameUpdateLayer({
    advance: () => {},
    getScene: scene,
    fpsController: { raise } as unknown as FpsController,
    markDirty,
  });
  return { layer, markDirty, raise };
}

describe('game update layer', () => {
  it('redraws when the ball is replaced — a respawn after the burst, a restart — and not while it rests', () => {
    const level = createTestLevel();
    let ball = createBall(level);
    const scene = (): SceneFrame => ({
      level,
      ball,
      burst: undefined,
      displayedStroke: 1,
      preview: undefined,
      aimRing: false,
    });
    const { layer, markDirty } = createLayer(scene);

    layer.update({ ...FRAME, time: 0 });
    layer.update({ ...FRAME, time: 0.016 });
    expect(markDirty).toHaveBeenCalledTimes(1);

    ball = respawn({ ...ball, phase: 'destroyed', position: { x: 4, y: 4 } });
    layer.update({ ...FRAME, time: 0.032 });

    expect(markDirty).toHaveBeenCalledTimes(2);
  });
});
