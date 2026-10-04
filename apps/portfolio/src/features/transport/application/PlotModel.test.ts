import type { ISnapshotRequest } from '@frozik/charts/data/snapshot/source';
import { assert } from '@frozik/utils/assert/assert';

import { CallFailedError } from '../domain/call-failure';
import type { PlotCurve, SampleRequest } from '../domain/plot';
import type { IPlotClient } from '../domain/ports/plot-client';
import { PlotModel } from './PlotModel';

const CURVE: PlotCurve = { x: [0, 1], y: [3, Number.NaN] };
const RETINA = 2;

function clientAnswering(sample: (request: SampleRequest) => Promise<PlotCurve>): IPlotClient {
  return {
    limits: () => Promise.resolve({ expressionMaxLength: 50, sampleMaxPoints: 3000 }),
    sample,
  };
}

function modelWith(client: IPlotClient): PlotModel {
  return new PlotModel({
    client,
    clock: { now: () => 0, every: () => () => undefined },
    devicePixelRatio: () => RETINA,
  });
}

function windowRequest(from: number, to: number, maxElements: number): ISnapshotRequest<number> {
  return { from, to, maxElements, shape: 'point', signal: new AbortController().signal };
}

describe('plot model', () => {
  it('samples each window the chart asks for, one point per ten physical pixels', async () => {
    const requests: SampleRequest[] = [];
    const model = modelWith(
      clientAnswering(request => {
        requests.push(request);
        return Promise.resolve(CURVE);
      })
    );
    model.setView({ expression: 'sin(x)', xMin: -1, xMax: 1 });

    model.plot();
    assert(model.state.kind === 'live');
    const window = await model.state.source.fetch(windowRequest(-3, 3, 900));

    expect(requests).toEqual([{ expression: 'sin(x)', xMin: -3, xMax: 3, points: 180 }]);
    expect(window.data).toEqual({
      shape: 'point',
      points: [
        { x: 0, value: 3 },
        { x: 1, value: Number.NaN },
      ],
    });
    expect(model.lastSample).toEqual({ points: 2, durationMs: 0 });
  });

  it('does not open a chart for input it can judge itself', () => {
    const sample = vi.fn();
    const model = modelWith(clientAnswering(sample));
    model.setView({ xMin: 5, xMax: 1 });

    model.plot();

    expect(sample).not.toHaveBeenCalled();
    expect(model.state).toEqual({ kind: 'invalid-input', error: 'invalid-range' });
  });

  it('turns a parse error from the chart into a caret under the expression', async () => {
    const failure = { kind: 'expression', position: 2, reason: 'unexpected-token' } as const;
    const model = modelWith(clientAnswering(() => Promise.reject(new CallFailedError(failure))));
    model.setView({ expression: 'x +* 1' });

    model.plot();
    assert(model.state.kind === 'live');
    await expect(model.state.source.fetch(windowRequest(0, 1, 100))).rejects.toThrow();

    expect(model.state).toMatchObject({ kind: 'failed', failure, view: { expression: 'x +* 1' } });
  });

  it('ignores answers that arrive for a chart already replaced', async () => {
    const model = modelWith(clientAnswering(() => Promise.resolve(CURVE)));
    model.plot();
    assert(model.state.kind === 'live');
    const stale = model.state.source;
    model.plot();

    await stale.fetch(windowRequest(0, 1, 100));

    expect(model.lastSample).toBeUndefined();
  });

  it('takes the server limits once they arrive', async () => {
    const model = modelWith(clientAnswering(() => Promise.resolve(CURVE)));
    await model.loadLimits(new AbortController().signal);
    expect(model.limits.sampleMaxPoints).toBe(3000);
  });
});
