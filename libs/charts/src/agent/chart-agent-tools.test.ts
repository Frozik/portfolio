import { assert } from '@frozik/utils/assert/assert';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../core/create-chart';
import { series } from '../core/series/series';
import { numberDomain } from '../core/viewport/number-domain';
import { staticData } from '../data/static-data';
import { smoothZoom } from '../extensions/smooth-zoom/core';
import { LINE_MARK } from '../marks/line/core';
import { createLineStyle } from '../marks/line/style';
import { createFakeHost } from '../testing/fake-host';
import { defineChartTarget } from './chart-agent-target';
import { defineChartTools } from './chart-agent-tools';
import { numberCodec } from './x-codec';

const SIZE = { width: 800, height: 400, devicePixelRatio: 2 };

function setup(cuts?: readonly { readonly from: number; readonly to: number }[], eased = false) {
  const chart = createChart({
    id: 'prices',
    x: { domain: numberDomain, start: 0, end: 100, cuts },
    series: [
      series({
        id: 'line',
        data: staticData<number>({
          shape: 'point',
          points: [
            { x: 0, value: 10 },
            { x: 50, value: 30 },
            { x: 100, value: 20 },
          ],
        }),
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions: eased ? [smoothZoom<number>()] : [],
  });
  chart.attach(createFakeHost(SIZE));
  chart.prepareFrame(0);
  const tools = defineChartTools({
    prefix: 'demo',
    targets: [defineChartTarget({ chart, codec: numberCodec })],
  });
  const call = (name: string, input: object = {}): Promise<unknown> => {
    const tool = tools.find((candidate: IAgentTool) => candidate.name === name);
    assert(!isNil(tool), `no ${name} tool`);
    return tool.run(input, new AbortController().signal);
  };
  return { chart, call };
}

describe('chart agent tools', () => {
  it('describe each chart: the range in view, the data, scales and series', async () => {
    const { call } = setup();

    await expect(call('demo_list_charts')).resolves.toMatchObject([
      {
        chart: 'prices',
        x: { from: '0', to: '100' },
        following: null,
        series: [{ id: 'line', name: 'line' }],
      },
    ]);
  });

  it('zoom round the middle of the view as the wheel does, or round a given position', async () => {
    const { call } = setup();

    await expect(call('demo_zoom', { chart: 'prices', factor: 0.5 })).resolves.toMatchObject({
      x: { from: '25', to: '75' },
    });
    await expect(
      call('demo_zoom', { chart: 'prices', factor: 2, at: '25' })
    ).resolves.toMatchObject({ x: { from: '25', to: '125' } });
  });

  it('scroll by screen widths and centre on a position, keeping the span', async () => {
    const { call } = setup();

    await expect(call('demo_scroll', { chart: 'prices', screens: 0.5 })).resolves.toMatchObject({
      x: { from: '50', to: '150' },
    });
    await expect(call('demo_go_to', { chart: 'prices', x: '500' })).resolves.toMatchObject({
      x: { from: '450', to: '550' },
    });
  });

  it('show an exact range, refusing one that runs backwards or cannot be read', async () => {
    const { call } = setup();

    await expect(
      call('demo_show_range', { chart: 'prices', from: '10', to: '20' })
    ).resolves.toMatchObject({ x: { from: '10', to: '20' } });
    await expect(
      call('demo_show_range', { chart: 'prices', from: '20', to: '10' })
    ).resolves.toEqual({ error: expect.stringMatching(/before/) });
    await expect(call('demo_go_to', { chart: 'prices', x: 'soon' })).resolves.toEqual({
      error: expect.stringMatching(/not a position/),
    });
  });

  it('read the element nearest to a position from what was drawn', async () => {
    const { call } = setup();

    await expect(call('demo_values_at', { chart: 'prices', x: '48' })).resolves.toEqual([
      { series: 'line', name: 'line', x: '50', value: 30 },
    ]);
  });

  it('refuse a scale the chart does not have and follow-live on a chart that does not stream', async () => {
    const { call } = setup();

    await expect(
      call('demo_zoom_scale', { chart: 'prices', scale: 'nope', factor: 2 })
    ).resolves.toEqual({ error: expect.stringMatching(/no "nope" scale/) });
    await expect(call('demo_follow_live', { chart: 'prices' })).resolves.toEqual({
      error: expect.stringMatching(/does not follow/),
    });
  });

  it('hold a stretched value scale and hand it back to autoscale on reset', async () => {
    const { chart, call } = setup();
    const [scaleId] = chart.viewport.scaleIds;
    assert(!isNil(scaleId), 'the chart has a value scale');

    const zoomed = await call('demo_zoom_scale', { chart: 'prices', scale: scaleId, factor: 2 });
    expect(zoomed).toMatchObject({ scales: [{ id: scaleId, heldByHand: true }] });

    await expect(call('demo_reset_scales', { chart: 'prices' })).resolves.toMatchObject({
      scales: [{ id: scaleId, heldByHand: false }],
    });
  });

  it('take positions in world coordinates on an axis with cuts and report them the same way', async () => {
    const { chart, call } = setup([{ from: 40, to: 60 }]);

    const shown = await call('demo_show_range', { chart: 'prices', from: '70', to: '90' });

    expect(chart.viewport.x.target).toEqual({ start: 50, end: 70 });
    expect(shown).toMatchObject({ x: { from: '70', to: '90' } });
  });

  it('scroll by the width the view is heading to, even while a zoom is still easing', async () => {
    const { chart, call } = setup(undefined, true);

    await call('demo_zoom', { chart: 'prices', factor: 0.5 });
    expect(chart.viewport.x.current).not.toEqual(chart.viewport.x.target);

    await expect(call('demo_scroll', { chart: 'prices', screens: 0.5 })).resolves.toMatchObject({
      x: { from: '50', to: '100' },
    });
  });
});
