import { createChart } from '@frozik/charts/core/create-chart';
import { series } from '@frozik/charts/core/series/series';
import { numberDomain } from '@frozik/charts/core/viewport/number-domain';
import { staticData } from '@frozik/charts/data/static-data';
import { smoothZoom } from '@frozik/charts/extensions/smooth-zoom/core';
import { LINE_MARK } from '@frozik/charts/marks/line/core';
import { createLineStyle } from '@frozik/charts/marks/line/style';
import { createFakeHost } from '@frozik/charts/testing/fake-host';
import { describe, expect, it } from 'vitest';

import { createSyncGroup } from './sync';

const SIZE = { width: 1000, height: 500, devicePixelRatio: 1 };
const data = staticData<number>({
  shape: 'point',
  points: [
    { x: 0, value: 1 },
    { x: 100, value: 2 },
  ],
});

function pair() {
  const group = createSyncGroup<number>();
  return [0, 1].map(index => {
    const chart = createChart({
      id: `chart-${index}`,
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [series({ id: 'line', data, style: createLineStyle<number>(LINE_MARK) })],
      extensions: [smoothZoom<number>(), group.member()],
    });
    chart.attach(createFakeHost(SIZE));
    chart.prepareFrame(0);
    return chart;
  });
}

describe('a group of synced charts', () => {
  it('moves every member with the one that is panned, and the move stays', () => {
    const [first, second] = pair();

    first.viewport.x.shift(-10);
    first.prepareFrame(16);
    second.prepareFrame(16);

    for (const chart of [first, second]) {
      expect(chart.viewport.x.current).toEqual({ start: -10, end: 90 });
      expect(chart.viewport.x.target).toEqual({ start: -10, end: 90 });
    }
  });

  it('follows whichever member is moved', () => {
    const [first, second] = pair();

    second.viewport.x.jump({ start: 40, end: 60 });

    expect(first.viewport.x.current).toEqual({ start: 40, end: 60 });
  });

  it('gives every member the target of a zoom, so they ease into it together', () => {
    const [first, second] = pair();

    first.viewport.x.setTarget({ start: 20, end: 80 });

    expect(second.viewport.x.target).toEqual({ start: 20, end: 80 });
    expect(second.viewport.x.current).toEqual({ start: 0, end: 100 });
  });

  it('lets a chart go once it is disposed of', () => {
    const [first, second] = pair();
    second.dispose();

    first.viewport.x.jump({ start: 40, end: 60 });

    expect(second.viewport.x.current).toEqual({ start: 0, end: 100 });
  });
});
