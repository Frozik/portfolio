import { describe, expect, it } from 'vitest';

import { SCENE_HEIGHT, SCENE_WIDTH, sceneScale, toScenePoint } from './scene-viewport';

describe('sceneScale', () => {
  it('keeps the scene 1:1 when the viewport is larger than the scene', () => {
    expect(sceneScale(SCENE_WIDTH * 2, SCENE_HEIGHT * 3)).toBe(1);
  });

  it('shrinks the scene to the tighter of the two viewport sides', () => {
    expect(sceneScale(SCENE_WIDTH / 2, SCENE_HEIGHT)).toBe(0.5);
    expect(sceneScale(SCENE_WIDTH, SCENE_HEIGHT / 4)).toBe(0.25);
  });
});

describe('toScenePoint', () => {
  it('maps the viewport centre to the scene origin', () => {
    expect(toScenePoint({ x: 200, y: 50 }, 400, 100)).toEqual({ x: 0, y: 0 });
  });

  it('maps the edge of a shrunk viewport to the edge of the scene', () => {
    const width = SCENE_WIDTH / 2;
    const height = SCENE_HEIGHT / 2;

    expect(toScenePoint({ x: width, y: 0 }, width, height)).toEqual({
      x: SCENE_WIDTH / 2,
      y: -SCENE_HEIGHT / 2,
    });
  });
});
