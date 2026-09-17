import { describe, expect, it } from 'vitest';

import {
  BAND_SPEED_PER_METER,
  FIXED_STEP_SECONDS,
  ROD_SPEED_METERS_PER_SECOND,
} from '../domain/constants';
import { generateLevel } from '../domain/generator/generate-level';
import type { Progress } from '../domain/progress';
import { createRod } from '../domain/rods';
import { createTestLevel } from '../domain/test-level';
import type { LevelSource } from './ports/level-source';
import type { ProgressRepository } from './ports/progress-repository';
import { BURST_SECONDS, SpaceGolfStore } from './SpaceGolfStore';

const FRAME = 1 / 60;

function createStore(saved?: Progress, source: LevelSource = generateLevel) {
  const saves: Progress[] = [];
  const repository: ProgressRepository = {
    load: () => Promise.resolve(saved),
    save: progress => {
      saves.push(progress);
      return Promise.resolve();
    },
  };
  return { store: new SpaceGolfStore(source, repository), saves };
}

describe('SpaceGolfStore', () => {
  it('loads the saved level and starts the ball on its tee', async () => {
    const { store } = createStore({ levelNumber: 3, totalStrokes: 11 });

    await store.start();

    expect(store.status).toBe('playing');
    expect(store.levelNumber).toBe(3);
    expect(store.totalStrokes).toBe(11);
    expect(store.scene?.level.seed).toBe(3);
    expect(store.scene?.ball.position).toEqual(store.scene?.level.tee);
  });

  it('shoots on release when the band is stretched and does nothing when it is slack', async () => {
    const { store } = createStore();
    await store.start();

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4.02, y: 4 });
    expect(store.preview).toBeUndefined();
    store.release();
    expect(store.strokeCount).toBe(0);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 2 });
    expect(store.preview).toHaveLength(5);
    store.release();

    expect(store.strokeCount).toBe(1);
    expect(store.scene?.ball.phase).toBe('flying');
    expect(store.aiming).toBeUndefined();
  });

  it('plays the burst and puts a destroyed ball back at its rest point', async () => {
    const { store } = createStore();
    await store.start();
    const scene = store.scene;
    if (scene === undefined) {
      throw new Error('no scene');
    }
    const destroyed = { ...scene.ball, phase: 'destroyed' as const, position: { x: 4, y: 4 } };
    // Reach into the private field the way the physics would: the ball is not observable.
    (store as unknown as { ball: typeof destroyed }).ball = destroyed;

    store.advance(FRAME);
    expect(store.scene?.burst).toBeDefined();
    for (let elapsed = 0; elapsed < BURST_SECONDS + FIXED_STEP_SECONDS; elapsed += FRAME) {
      store.advance(FRAME);
    }

    expect(store.scene?.burst).toBeUndefined();
    expect(store.scene?.ball.phase).toBe('aiming');
    expect(store.scene?.ball.position).toEqual(scene.level.tee);
  });

  it('walks the levels in both directions, saves where it is and never goes below the first', async () => {
    const { store, saves } = createStore();
    await store.start();
    expect(store.hasPreviousLevel).toBe(false);

    store.previousLevel();
    expect(store.levelNumber).toBe(1);
    expect(saves).toHaveLength(0);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 2 });
    store.release();
    store.nextLevel();

    expect(store.levelNumber).toBe(2);
    expect(store.scene?.level.seed).toBe(2);
    expect(store.strokeCount).toBe(0);
    expect(store.scene?.ball.phase).toBe('aiming');
    expect(saves).toEqual([{ levelNumber: 2, totalStrokes: 0 }]);

    store.previousLevel();
    expect(store.levelNumber).toBe(1);
    expect(saves).toEqual([
      { levelNumber: 2, totalStrokes: 0 },
      { levelNumber: 1, totalStrokes: 0 },
    ]);
  });

  it('completes the level when the ball holes out, adds the strokes to the total and serves the next level', async () => {
    const { store, saves } = createStore(undefined, () => createTestLevel());
    await store.start();

    // The tee is at x = 1 on the floor, the cup at x = 4.5: a roll of about four metres.
    store.beginAim({ x: 0, y: 0 });
    store.updateAim({ x: -4.2 / BAND_SPEED_PER_METER, y: 0 });
    store.release();
    for (let elapsed = 0; elapsed < 10 && store.status !== 'completed'; elapsed += FRAME) {
      store.advance(FRAME);
    }

    expect(store.status).toBe('completed');
    expect(store.strokeCount).toBe(1);
    expect(store.totalStrokes).toBe(1);
    expect(saves.at(-1)).toEqual({ levelNumber: 2, totalStrokes: 1 });

    store.nextLevel();

    expect(store.status).toBe('playing');
    expect(store.levelNumber).toBe(2);
    expect(store.strokeCount).toBe(0);
  });

  it('drops the held aim when a rod knocks the resting ball into flight', async () => {
    const level = createTestLevel();
    const overTee = createRod(
      'slide',
      { x: level.tee.x, y: level.height },
      { x: 0, y: -1 },
      level.height
    );
    const { store } = createStore(undefined, () => ({ ...level, rods: [overTee] }));
    await store.start();

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 2 });
    expect(store.preview).toHaveLength(5);
    // The rod has the whole board to cross before it reaches the tee.
    const framesToCross = Math.ceil((60 * level.height) / ROD_SPEED_METERS_PER_SECOND);
    for (let frame = 0; frame < framesToCross && store.scene?.ball.phase === 'aiming'; frame += 1) {
      store.advance(FRAME);
    }

    expect(store.scene?.ball.phase).toBe('flying');
    expect(store.aiming).toBeUndefined();
    expect(store.preview).toBeUndefined();
    store.release();
    expect(store.strokeCount).toBe(0);
  });
});
