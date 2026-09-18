import { describe, expect, it } from 'vitest';

import { CLOCK_SPEED, FIXED_STEP_SECONDS } from '../domain/constants';
import { cupCenter, hasCup } from '../domain/cup';
import { sectorAt } from '../domain/generator/generate-sector';
import type { SavedWorld, WorldRepository } from './ports/world-repository';
import { SpaceGolfStore } from './SpaceGolfStore';

const FRAME = 1 / 60;
const PHONE = { width: 390, height: 844 };
/** A phone's sector is twelve metres wide at 64 pixels a metre. */
const PIXELS_PER_SECTOR = 64 * 12;

function createStore(saved?: SavedWorld) {
  const saves: SavedWorld[] = [];
  let cleared = 0;
  const repository: WorldRepository = {
    load: () => Promise.resolve(saved),
    save: world => {
      saves.push(world);
      return Promise.resolve();
    },
    clear: () => {
      cleared += 1;
      return Promise.resolve();
    },
  };
  let seed = 11;
  const store = new SpaceGolfStore(repository, () => {
    seed += 1;
    return seed;
  });
  return { store, saves, cleared: () => cleared };
}

function playUntilRest(store: SpaceGolfStore): void {
  for (let frame = 0; frame < 60 * 20 && store.scene?.ball.phase !== 'aiming'; frame += 1) {
    store.advance(FRAME);
  }
}

describe('SpaceGolfStore', () => {
  it('makes a new world sized to the screen it starts on, the ball on its tee, a cup somewhere, and saves it', async () => {
    const { store, saves } = createStore();

    await store.start(PHONE);

    expect(store.status).toBe('playing');
    expect(store.holes).toBe(0);
    expect(store.scene?.ball.phase).toBe('aiming');
    expect(store.scene?.slices.length).toBeGreaterThanOrEqual(9);
    expect(hasCup(store.scene?.level ?? ({ cup: undefined } as never))).toBe(true);
    expect(saves).toHaveLength(1);
    expect(saves[0].play.course.size).toEqual({ widthCells: 24, heightCells: 27 });
  });

  it('puts the player back on the very spot of a saved world', async () => {
    const first = createStore();
    await first.store.start(PHONE);
    first.store.beginAim({ x: 4, y: 4 });
    first.store.updateAim({ x: 3.4, y: 3 });
    first.store.release();
    playUntilRest(first.store);
    const saved = first.saves[first.saves.length - 1];

    const second = createStore(saved);
    await second.store.start({ width: 1600, height: 900 });

    expect(second.store.totalStrokes).toBe(1);
    expect(second.store.scene?.ball.position).toEqual(first.store.scene?.ball.position);
    expect(second.store.scene?.slices.length).toBe(saved.play.course.sectors.length);
    expect(second.saves).toHaveLength(0);
  });

  it('counts a stroke on release when the band is stretched and does nothing when it is slack', async () => {
    const { store } = createStore();
    await store.start(PHONE);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4.02, y: 4 });
    expect(store.preview).toBeUndefined();
    store.release();
    expect(store.totalStrokes).toBe(0);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 2 });
    expect(store.preview).toHaveLength(5);
    store.release();
    expect(store.totalStrokes).toBe(1);
    expect(store.strokesSinceHole).toBe(1);
    expect(store.scene?.ball.phase).toBe('flying');
  });

  it('lets the band be pulled while the ball still moves; letting go then plays nothing, letting go once it rests plays the stroke', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3.4 });
    store.release();

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3 });
    expect(store.preview).toHaveLength(5);
    store.release();
    expect(store.totalStrokes).toBe(1);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3.4 });
    playUntilRest(store);
    expect(store.aiming).toBeDefined();
    store.release();
    expect(store.totalStrokes).toBe(2);
  });

  it('never lets the ball fly over ground that is not there: the map is made ahead of it, however far it goes', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    const size = { widthCells: 24, heightCells: 27 };

    for (let stroke = 0; stroke < 6; stroke += 1) {
      store.beginAim({ x: 4, y: 4 });
      store.updateAim({ x: 2.7, y: 4.3 });
      store.release();
      for (let frame = 0; frame < 60 * 20 && store.scene?.ball.phase === 'flying'; frame += 1) {
        store.advance(FRAME);
        const scene = store.scene;
        const here = sectorAt(size, scene?.ball.position ?? { x: 0, y: 0 });
        expect(
          scene?.slices.some(({ sector }) => sector.sx === here.sx && sector.sy === here.sy)
        ).toBe(true);
      }
    }
  });

  it('plays on after a hole-out: the hole is counted, the strokes since it start over, a new cup lies elsewhere, and the world is saved', async () => {
    const { store, saves } = createStore();
    await store.start(PHONE);
    const before = store.scene;
    const level = before?.level;
    const oldCup = level !== undefined && hasCup(level) ? cupCenter(level) : { x: 0, y: 0 };
    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3.4 });
    store.release();
    playUntilRest(store);
    const saved = saves[saves.length - 1];

    const inTheCup = createStore({
      ...saved,
      play: {
        ...saved.play,
        ball: { ...saved.play.ball, phase: 'holed', position: oldCup },
      },
    });
    await inTheCup.store.start(PHONE);
    inTheCup.store.advance((FIXED_STEP_SECONDS / CLOCK_SPEED) * 1.5);

    expect(inTheCup.store.holes).toBe(1);
    expect(inTheCup.store.strokesSinceHole).toBe(0);
    expect(inTheCup.store.totalStrokes).toBe(1);
    expect(inTheCup.store.scene?.ball.phase).toBe('aiming');
    const next = inTheCup.store.scene?.level;
    const newCup = next !== undefined && hasCup(next) ? cupCenter(next) : oldCup;
    expect(Math.hypot(newCup.x - oldCup.x, newCup.y - oldCup.y)).toBeGreaterThan(1);
    expect(inTheCup.saves.length).toBeGreaterThan(0);
  });

  it('starts a new world on demand: other country, the counters at nought', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3.4 });
    store.release();
    const oldSeed = store.scene?.level.seed;

    store.resetWorld();

    expect(store.totalStrokes).toBe(0);
    expect(store.scene?.level.seed).not.toBe(oldSeed);
    expect(store.scene?.ball.phase).toBe('aiming');
  });

  it('draws the ball between two physics steps by the share of a step the frame has left over, so its motion is even at any frame rate', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 3, y: 3 });
    store.release();
    const tee = store.scene?.ball.position ?? { x: 0, y: 0 };

    store.advance((FIXED_STEP_SECONDS / CLOCK_SPEED) * 2.5);

    const scene = store.scene;
    const after = scene?.ball.position ?? tee;
    const shown = scene?.ballPosition ?? tee;
    const travelled = Math.hypot(after.x - tee.x, after.y - tee.y);
    const shownTravel = Math.hypot(shown.x - tee.x, shown.y - tee.y);
    expect(shownTravel).toBeLessThan(travelled);
    expect(shownTravel).toBeGreaterThan(travelled * 0.6);
  });

  it('trails the flying ball with its last positions and drops the trail once it rests', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    expect(store.scene?.trail).toEqual([]);
    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3.4 });
    store.release();

    store.advance(FRAME);
    store.advance(FRAME);
    expect(store.scene?.trail.length).toBeGreaterThan(2);

    playUntilRest(store);
    for (let frame = 0; frame < 6; frame += 1) {
      store.advance(FRAME);
    }
    expect(store.scene?.trail).toEqual([]);
  });

  it('takes the view back to the ball when a stroke is played: the flight is what must be watched', async () => {
    const { store } = createStore();
    await store.start(PHONE);

    store.view.pan(0, 300);
    expect(store.view.isAttached).toBe(false);
    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 3, y: 3 });
    store.release();

    expect(store.view.isAttached).toBe(true);
  });

  it('makes the sectors the player looks at, a frame at a time', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    const sectorsAway = 6;
    const lookedAt = (): boolean =>
      store.scene?.slices.some(({ sector }) => sector.sx === sectorsAway) ?? false;
    expect(lookedAt()).toBe(false);

    store.view.pan(PIXELS_PER_SECTOR * sectorsAway, 0);
    for (let frame = 0; frame < 10; frame += 1) {
      store.advance(FRAME);
    }

    expect(lookedAt()).toBe(true);
  });

  it('makes the country round a resting ball frame by frame, stops with the stroke and goes on when the ball rests again', async () => {
    const { store } = createStore();
    await store.start(PHONE);
    const made = (): number => store.scene?.slices.length ?? 0;
    const atStart = made();

    store.advance(FRAME);
    store.advance(FRAME);
    expect(made()).toBe(atStart + 2);

    store.beginAim({ x: 4, y: 4 });
    store.updateAim({ x: 4, y: 3.7 });
    store.release();
    const atRelease = made();
    for (let frame = 0; frame < 10 && store.scene?.ball.phase === 'flying'; frame += 1) {
      store.advance(FRAME);
      expect(made()).toBe(atRelease);
    }

    playUntilRest(store);
    const atRest = made();
    store.advance(FRAME);
    expect(made()).toBe(atRest + 1);
  });
});
