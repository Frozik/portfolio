import { describe, expect, it } from 'vitest';

import { BAND_SPEED_PER_METER, FIXED_STEP_SECONDS } from '../domain/constants';
import { generateLevel } from '../domain/generator/generate-level';
import { solve } from '../domain/generator/solver';
import type { Level } from '../domain/level';
import type { Progress } from '../domain/progress';
import { createTestLevel } from '../domain/test-level';
import type { LevelSource } from './ports/level-source';
import type { ProgressRepository } from './ports/progress-repository';
import { BURST_SECONDS, SpaceGolfStore } from './SpaceGolfStore';

const SEED = 1;
const FRAME = 1 / 60;

function createStore(saved?: Progress, generate: (seed: number) => Level = generateLevel) {
  const saves: Progress[] = [];
  const source: LevelSource = {
    generate: seed => Promise.resolve(generate(seed)),
    dispose: () => {},
  };
  const repository: ProgressRepository = {
    load: () => Promise.resolve(saved),
    save: progress => {
      saves.push(progress);
      return Promise.resolve();
    },
  };
  return { store: new SpaceGolfStore(source, repository), saves };
}

/** Runs frames until the ball is at rest again, holed, or the time is up. */
function settle(store: SpaceGolfStore, maxSeconds = 8): void {
  for (let elapsed = 0; elapsed < maxSeconds; elapsed += FRAME) {
    store.advance(FRAME);
    const phase = store.scene?.ball.phase;
    if (store.status === 'completed' || (phase === 'aiming' && store.scene?.burst === undefined)) {
      return;
    }
  }
}

describe('SpaceGolfStore', () => {
  it('loads the saved level and starts the ball on its tee', async () => {
    const { store } = createStore({ levelNumber: 3, totalStrokes: 11, bestByLevel: {} });

    await store.start();

    expect(store.status).toBe('playing');
    expect(store.levelNumber).toBe(3);
    expect(store.totalStrokes).toBe(11);
    expect(store.scene?.ball.position).toEqual(store.scene?.level.tee);
    expect(store.par).toBeGreaterThanOrEqual(2);
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

  it(
    'completes the level along the solver strokes, saves the progress and serves the next level',
    { timeout: 60_000 },
    async () => {
      const { store, saves } = createStore();
      await store.start();
      const level = generateLevel(SEED);
      const solution = solve(level);
      if (solution === undefined) {
        throw new Error('level 1 must be solvable');
      }

      for (const velocity of solution.strokes) {
        store.beginAim({ x: 0, y: 0 });
        store.updateAim({
          x: -velocity.x / BAND_SPEED_PER_METER,
          y: -velocity.y / BAND_SPEED_PER_METER,
        });
        store.release();
        settle(store);
      }

      expect(store.status).toBe('completed');
      expect(saves).toHaveLength(1);
      expect(saves[0].levelNumber).toBe(2);
      expect(store.totalStrokes).toBe(solution.strokes.length);

      await store.nextLevel();

      expect(store.levelNumber).toBe(2);
      expect(store.status).toBe('playing');
      expect(store.strokeCount).toBe(0);
    }
  );

  it('counts the pickups the ball collects and forgets them on a restart', async () => {
    const arena = createTestLevel();
    const withPickup: Level = {
      ...arena,
      pickups: [{ position: { x: 2, y: arena.tee.y + 0.1 }, shape: 'ring' }],
    };
    const { store } = createStore(undefined, () => withPickup);
    await store.start();
    expect(store.pickupCount).toBe(1);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4 - 2 / BAND_SPEED_PER_METER, y: 4 });
    store.release();
    settle(store);

    expect(store.collectedCount).toBe(1);
    store.restart();
    expect(store.collectedCount).toBe(0);
  });
});
