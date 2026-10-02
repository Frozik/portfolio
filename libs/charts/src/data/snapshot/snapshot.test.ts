import { describe, expect, it } from 'vitest';

import { ChartDataError } from '../../core/series/data-error';
import type { IDataNeed, ISeriesData } from '../../core/series/series-data';
import type { TBatch } from '../../core/series/shape';
import type { IAxisRange } from '../../core/viewport/axis-domain';
import { numberDomain } from '../../core/viewport/number-domain';
import { snapshot } from './snapshot';
import { snapshotOf } from './snapshot-of';
import type { ISnapshotRequest, ISnapshotSource, ISnapshotWindow } from './source';

function need(start: number, end: number): IDataNeed<number> {
  return { range: { start, end }, shape: 'point', pixelsPerElement: 1, widthPx: 100 };
}

function firstValue(data: ISeriesData<number>, wanted: IDataNeed<number>): number | undefined {
  const [run] = data.runs(wanted);
  return run?.shape === 'point' ? run.value[0] : undefined;
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await Promise.resolve();
  }
}

/** Answers every request with one point per unit over exactly what was asked. */
function windowedSource() {
  const requests: ISnapshotRequest<number>[] = [];
  let notify: (range?: IAxisRange<number>) => void = () => {};
  let version = 0;
  const control = {
    requests,
    failWith: undefined as ChartDataError | undefined,
    change(range?: IAxisRange<number>): void {
      version += 1;
      notify(range);
    },
  };
  const source: ISnapshotSource<number> = {
    async fetch(request): Promise<ISnapshotWindow<number>> {
      requests.push(request);
      if (control.failWith !== undefined) {
        throw control.failWith;
      }
      const points = [];
      for (let x = Math.ceil(request.from); x <= request.to; x += 1) {
        points.push({ x, value: version });
      }
      return { data: { shape: 'point', points }, range: { start: request.from, end: request.to } };
    },
    subscribe(onChange): VoidFunction {
      notify = onChange;
      return () => {
        notify = () => {};
      };
    },
  };
  return { source, control };
}

function opened(source: ISnapshotSource<number>, scales?: readonly number[]): ISeriesData<number> {
  const data = snapshot(source, { scales }).create({ domain: numberDomain });
  data.activate();
  return data;
}

describe('a snapshot', () => {
  it('asks for a window wider than the view, so a small pan asks for nothing', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);

    data.prepare([need(100, 200)]);
    await settle();
    data.prepare([need(150, 250)]);
    await settle();

    expect(control.requests).toHaveLength(1);
    expect(control.requests[0]).toMatchObject({ from: 0, to: 300, shape: 'point' });
    expect(data.runs(need(150, 250))).toHaveLength(1);
  });

  it('asks again when the view leaves the window', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    data.prepare([need(100, 200)]);
    await settle();

    data.prepare([need(250, 350)]);
    await settle();

    expect(control.requests).toHaveLength(2);
    expect(control.requests[1]).toMatchObject({ from: 150, to: 450 });
  });

  it('keeps drawing the old window while the new one is on its way, and shows only the missing part as loading', async () => {
    const { source } = windowedSource();
    const data = opened(source);
    data.prepare([need(100, 200)]);
    await settle();
    const [old] = data.runs(need(100, 200));

    data.prepare([need(250, 350)]);

    expect(data.runs(need(250, 350))).toEqual([old]);
    expect(data.loading).toEqual([{ start: 300, end: 350 }]);
    await settle();
    expect(data.runs(need(250, 350))[0].id).not.toBe(old.id);
    expect(data.loading).toEqual([]);
  });

  it('asks again when the zoom moves to another of the named scales', async () => {
    const { source, control } = windowedSource();
    const data = opened(source, [1, 10]);
    data.prepare([need(100, 200)]);
    await settle();

    data.prepare([need(100, 180)]);
    await settle();
    expect(control.requests).toHaveLength(1);

    data.prepare([need(0, 2000)]);
    await settle();
    expect(control.requests.map(request => request.scale)).toEqual([1, 10]);
  });

  it('without named scales, asks again once the density is more than twice off', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    data.prepare([need(100, 200)]);
    await settle();

    data.prepare([need(120, 180)]);
    await settle();
    expect(control.requests).toHaveLength(1);

    data.prepare([need(140, 160)]);
    await settle();
    expect(control.requests).toHaveLength(2);
  });

  it('reads the window again when the source says it changed, once for several changes', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    const changed: unknown[] = [];
    data.subscribe({ changed: range => changed.push(range), failed: () => {} });
    data.prepare([need(100, 200)]);
    await settle();
    changed.length = 0;

    control.change();
    control.change();
    expect(changed).toHaveLength(2);
    data.prepare([need(100, 200)]);
    await settle();

    expect(control.requests).toHaveLength(2);
    expect(firstValue(data, need(100, 200))).toBe(2);
  });

  it('ignores a change that does not touch the window', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    data.prepare([need(100, 200)]);
    await settle();

    control.change({ start: 1000, end: 2000 });
    data.prepare([need(100, 200)]);
    await settle();

    expect(control.requests).toHaveLength(1);
  });

  it('lets only the last of two overlapping requests win', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);

    data.prepare([need(100, 200)]);
    data.prepare([need(1000, 1100)]);
    await settle();

    expect(control.requests[0].signal.aborted).toBe(true);
    expect(data.runs(need(1000, 1100))[0].x[0]).toBe(900);
  });

  it('reports a failure and does not ask again until told to retry', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    control.failWith = new ChartDataError('UNAVAILABLE', 'down');

    data.prepare([need(100, 200)]);
    await settle();
    data.prepare([need(100, 200)]);
    await settle();
    expect(control.requests).toHaveLength(1);
    expect(data.failed.map(failure => failure.error.code)).toEqual(['UNAVAILABLE']);

    control.failWith = undefined;
    data.retry({ start: 100, end: 200 });
    data.prepare([need(100, 200)]);
    await settle();
    expect(data.failed).toEqual([]);
    expect(data.runs(need(100, 200))).toHaveLength(1);
  });

  it('asks again once the view has left the range that failed', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    control.failWith = new ChartDataError('INTERNAL', 'broken');
    data.prepare([need(100, 200)]);
    await settle();
    control.failWith = undefined;

    data.prepare([need(5000, 5100)]);
    await settle();

    expect(control.requests).toHaveLength(2);
    expect(data.failed).toEqual([]);
    expect(data.runs(need(5000, 5100))).toHaveLength(1);
  });

  it('asks nothing while the chart is off the stage', async () => {
    const { source, control } = windowedSource();
    const data = opened(source);
    data.suspend();

    data.prepare([need(100, 200)]);
    await settle();

    expect(control.requests).toHaveLength(0);
  });
});

describe('a snapshot source that answers with everything at a named scale', () => {
  it('is asked again when the zoom moves to another scale, not when the view moves', async () => {
    const scales: (number | undefined)[] = [];
    const source: ISnapshotSource<number> = {
      async fetch(request): Promise<ISnapshotWindow<number>> {
        scales.push(request.scale);
        return { data: { shape: 'point', points: [{ x: 1, value: 1 }] } };
      },
      subscribe: () => () => {},
    };
    const data = opened(source, [1, 10]);
    data.prepare([need(100, 200)]);
    await settle();

    data.prepare([need(5000, 5100)]);
    await settle();
    expect(scales).toEqual([1]);

    data.prepare([need(0, 2000)]);
    await settle();
    expect(scales).toEqual([1, 10]);
  });
});

describe('a snapshot of data held in memory', () => {
  it('reads everything once and again only on a change, whatever the view', async () => {
    let held: TBatch<number> = { shape: 'point', points: [{ x: 1, value: 1 }] };
    let reads = 0;
    let notify: VoidFunction = () => {};
    const data = opened(
      snapshotOf(
        () => {
          reads += 1;
          return held;
        },
        onChange => {
          notify = onChange;
          return () => {};
        }
      )
    );

    data.prepare([need(0, 10)]);
    await settle();
    data.prepare([need(5000, 9000)]);
    await settle();
    expect(reads).toBe(1);

    held = { shape: 'point', points: [{ x: 1, value: 2 }] };
    notify();
    data.prepare([need(5000, 9000)]);
    await settle();
    expect(reads).toBe(2);
    expect(firstValue(data, need(0, 10))).toBe(2);
  });
});
