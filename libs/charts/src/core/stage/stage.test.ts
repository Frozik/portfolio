import { describe, expect, it } from 'vitest';

import { createFakeHost } from '../../testing/fake-host';
import { mountLineChart } from '../../testing/line-chart';
import type { IChartFrame } from '../frame/chart-frame';
import type { IFrameScheduler } from '../host/frame-scheduler';
import type { IPaintContribution, IRenderBackend } from './backend';
import { PAINT_BAND } from './backend';
import { createStage } from './stage';

const SIZE = { width: 1000, height: 500, devicePixelRatio: 1 };

/** Frames run when the test says so. */
function manualScheduler() {
  let pending: ((now: number) => void) | undefined;
  const scheduler: IFrameScheduler = {
    request(callback) {
      pending = callback;
      return 1;
    },
    cancel() {
      pending = undefined;
    },
  };
  return {
    scheduler,
    get isRunning(): boolean {
      return pending !== undefined;
    },
    frame(now: number): void {
      const callback = pending;
      pending = undefined;
      callback?.(now);
    },
  };
}

function recordingBackend(id: string) {
  const log: string[] = [];
  const painted: IChartFrame<unknown>[] = [];
  const backend: IRenderBackend = {
    id,
    createSurface(canvas, contributions) {
      log.push(`surface:${String(canvas)}:${contributions.map(each => each.id).join(',')}`);
      return {
        paint(frame) {
          log.push(`paint:${String(canvas)}`);
          painted.push(frame);
        },
        dispose() {
          log.push(`dispose:${String(canvas)}`);
        },
      };
    },
    beginFrame: () => log.push('begin'),
    endFrame: () => log.push('end'),
    dispose: () => log.push('destroyed'),
  };
  return { backend, log, painted };
}

function chart() {
  const { chart: model } = mountLineChart([]);
  model.detach();
  return model;
}

describe('a stage', () => {
  it('draws every chart of a backend between one begin and one end of a frame', async () => {
    const clock = manualScheduler();
    const { backend, log } = recordingBackend('fake');
    const stage = await createStage({ backends: [backend], scheduler: clock.scheduler });
    stage.mount(chart(), { host: createFakeHost(SIZE), canvases: { fake: 'first' } });
    stage.mount(chart(), { host: createFakeHost(SIZE), canvases: { fake: 'second' } });
    log.length = 0;

    clock.frame(1000);

    expect(log).toEqual(['begin', 'paint:first', 'paint:second', 'end']);
  });

  it('waits for backends that take time to come up', async () => {
    const { backend } = recordingBackend('slow');

    const stage = await createStage({
      backends: [Promise.resolve(backend)],
      scheduler: manualScheduler().scheduler,
    });

    expect(stage.backendIds).toEqual(['slow']);
    expect(stage.supports('slow')).toBe(true);
  });

  it('runs at the idle rate while nothing moves', async () => {
    const clock = manualScheduler();
    const { backend, painted } = recordingBackend('fake');
    const stage = await createStage({ backends: [backend], scheduler: clock.scheduler });
    stage.mount(chart(), { host: createFakeHost(SIZE), canvases: { fake: 'canvas' } });
    for (let now = 1000; now < 3000; now += 16) {
      clock.frame(now);
    }
    painted.length = 0;

    for (let now = 3000; now < 4000; now += 16) {
      clock.frame(now);
    }

    expect(painted.length).toBeGreaterThanOrEqual(9);
    expect(painted.length).toBeLessThanOrEqual(11);
  });

  it('gives each backend only the contributions drawn on it', async () => {
    const lower = recordingBackend('lower');
    const upper = recordingBackend('upper');
    const stage = await createStage({
      backends: [lower.backend, upper.backend],
      scheduler: manualScheduler().scheduler,
    });
    const contribution = (id: string, backend: string): IPaintContribution => ({
      id,
      backend,
      band: PAINT_BAND.annotation,
      painter: undefined,
    });
    const { chart: model } = mountLineChart([
      {
        id: 'both',
        create: () => ({
          slice: undefined,
          paint: [contribution('grid', 'lower'), contribution('axes', 'upper')],
        }),
      },
    ]);
    model.detach();

    stage.mount(model, { host: createFakeHost(SIZE), canvases: { lower: 'a', upper: 'b' } });

    expect(lower.log).toContain('surface:a:grid');
    expect(upper.log).toContain('surface:b:axes');
  });

  it('refuses a chart that draws on a backend it is not mounted on', async () => {
    const { backend } = recordingBackend('fake');
    const stage = await createStage({
      backends: [backend],
      scheduler: manualScheduler().scheduler,
    });
    const { chart: model } = mountLineChart([
      {
        id: 'elsewhere',
        create: () => ({
          slice: undefined,
          paint: [{ id: 'x', backend: 'missing', band: PAINT_BAND.annotation, painter: undefined }],
        }),
      },
    ]);
    model.detach();

    expect(() =>
      stage.mount(model, { host: createFakeHost(SIZE), canvases: { fake: 'canvas' } })
    ).toThrow(/"missing" backend/);
  });

  it('takes a chart off: its surfaces are disposed, and the loop stops with the last chart', async () => {
    const clock = manualScheduler();
    const { backend, log } = recordingBackend('fake');
    const stage = await createStage({ backends: [backend], scheduler: clock.scheduler });
    const model = chart();
    const unmount = stage.mount(model, {
      host: createFakeHost(SIZE),
      canvases: { fake: 'canvas' },
    });
    expect(clock.isRunning).toBe(true);

    unmount();

    expect(log).toContain('dispose:canvas');
    expect(model.isMounted).toBe(false);
    expect(clock.isRunning).toBe(false);
  });

  it('destroys its backends and takes every chart off when destroyed', async () => {
    const { backend, log } = recordingBackend('fake');
    const stage = await createStage({
      backends: [backend],
      scheduler: manualScheduler().scheduler,
    });
    const model = chart();
    stage.mount(model, { host: createFakeHost(SIZE), canvases: { fake: 'canvas' } });

    stage.destroy();

    expect(log).toEqual(expect.arrayContaining(['dispose:canvas', 'destroyed']));
    expect(model.isMounted).toBe(false);
    expect(() =>
      stage.mount(chart(), { host: createFakeHost(SIZE), canvases: { fake: 'canvas' } })
    ).toThrow(/destroyed/);
  });
});

describe('a stage choosing who draws', () => {
  const alternatives = (
    id: string,
    ...backends: readonly string[]
  ): readonly IPaintContribution[] =>
    backends.map(backend => ({ id, backend, band: PAINT_BAND.grid, painter: undefined }));

  function chartDrawing(contributions: readonly IPaintContribution[]) {
    const { chart: model } = mountLineChart([
      { id: 'drawing', create: () => ({ slice: undefined, paint: contributions }) },
    ]);
    model.detach();
    return model;
  }

  it('gives a contribution offered for several backends to the lowest one of the stack', async () => {
    const lower = recordingBackend('lower');
    const upper = recordingBackend('upper');
    const stage = await createStage({
      backends: [lower.backend, upper.backend],
      scheduler: manualScheduler().scheduler,
    });

    stage.mount(chartDrawing(alternatives('grid', 'upper', 'lower')), {
      host: createFakeHost(SIZE),
      canvases: { lower: 'a', upper: 'b' },
    });

    expect(lower.log).toContain('surface:a:grid');
    expect(upper.log).toContain('surface:b:');
  });

  it('falls back to the backend that is there when the preferred one is not on the stage', async () => {
    const only = recordingBackend('upper');
    const stage = await createStage({
      backends: [only.backend],
      scheduler: manualScheduler().scheduler,
    });

    stage.mount(chartDrawing(alternatives('grid', 'lower', 'upper')), {
      host: createFakeHost(SIZE),
      canvases: { upper: 'b' },
    });

    expect(only.log).toContain('surface:b:grid');
  });

  it('has the bottom backend of the stack draw the series, and only it', async () => {
    const roles: string[] = [];
    const backend = (id: string): IRenderBackend => ({
      id,
      createSurface(_canvas, _contributions, role) {
        roles.push(`${id}:${role.drawsSeries}`);
        return { paint: () => {}, dispose: () => {} };
      },
      beginFrame: () => {},
      endFrame: () => {},
      dispose: () => {},
    });
    const stage = await createStage({
      backends: Promise.resolve([backend('lower'), backend('upper')]),
      scheduler: manualScheduler().scheduler,
    });

    stage.mount(chart(), { host: createFakeHost(SIZE), canvases: { lower: 'a', upper: 'b' } });
    stage.mount(chart(), { host: createFakeHost(SIZE), canvases: { upper: 'b' } });

    expect(roles).toEqual(['lower:true', 'upper:false', 'upper:true']);
  });
});

describe('a stage that lost a backend', () => {
  function losable(id: string) {
    const recorded = recordingBackend(id);
    let lose: (reason: string) => void = () => {};
    const lost = new Promise<string>(resolve => {
      lose = resolve;
    });
    return { ...recorded, backend: { ...recorded.backend, lost }, lose };
  }

  const both = (id: string): readonly IPaintContribution[] => [
    { id, backend: 'lower', band: PAINT_BAND.grid, painter: undefined },
    { id, backend: 'upper', band: PAINT_BAND.grid, painter: undefined },
  ];

  function drawing(contributions: readonly IPaintContribution[]) {
    const { chart: model } = mountLineChart([
      { id: 'drawing', create: () => ({ slice: undefined, paint: contributions }) },
    ]);
    model.detach();
    return model;
  }

  async function settled(promise: Promise<string>): Promise<string | undefined> {
    return Promise.race([promise, new Promise<undefined>(resolve => setTimeout(resolve, 0))]);
  }

  it('goes on with the backends left: they take over what the lost one drew', async () => {
    const clock = manualScheduler();
    const lower = losable('lower');
    const upper = recordingBackend('upper');
    const stage = await createStage({
      backends: [lower.backend, upper.backend],
      scheduler: clock.scheduler,
    });
    const model = drawing(both('grid'));
    stage.mount(model, { host: createFakeHost(SIZE), canvases: { lower: 'a', upper: 'b' } });
    upper.log.length = 0;

    lower.lose('device lost');
    await Promise.resolve();
    clock.frame(1000);

    expect(stage.backendIds).toEqual(['upper']);
    expect(upper.log).toEqual(['dispose:b', 'surface:b:grid', 'begin', 'paint:b', 'end']);
    expect(lower.log).toEqual(expect.arrayContaining(['dispose:a', 'destroyed']));
    expect(model.isMounted).toBe(true);
    expect(await settled(stage.lost)).toBeUndefined();
  });

  it('is lost when a chart draws something only the lost backend could', async () => {
    const lower = losable('lower');
    const upper = recordingBackend('upper');
    const stage = await createStage({
      backends: [lower.backend, upper.backend],
      scheduler: manualScheduler().scheduler,
    });
    stage.mount(
      drawing([{ id: 'gpu-only', backend: 'lower', band: PAINT_BAND.grid, painter: undefined }]),
      { host: createFakeHost(SIZE), canvases: { lower: 'a', upper: 'b' } }
    );

    lower.lose('device lost');

    expect(await settled(stage.lost)).toBe('device lost');
    expect(stage.backendIds).toEqual(['lower', 'upper']);
  });

  it('is lost when the backend was the only one', async () => {
    const only = losable('only');
    const stage = await createStage({
      backends: [only.backend],
      scheduler: manualScheduler().scheduler,
    });

    only.lose('device lost');

    expect(await settled(stage.lost)).toBe('device lost');
  });

  it('mounts a chart that comes after the loss on what is left', async () => {
    const lower = losable('lower');
    const upper = recordingBackend('upper');
    const stage = await createStage({
      backends: [lower.backend, upper.backend],
      scheduler: manualScheduler().scheduler,
    });
    lower.lose('device lost');
    await Promise.resolve();

    stage.mount(drawing(both('grid')), {
      host: createFakeHost(SIZE),
      canvases: { lower: 'a', upper: 'b' },
    });

    expect(upper.log).toContain('surface:b:grid');
  });
});
