import { defineChartTarget } from '@frozik/charts/agent/chart-agent-target';
import { defineChartTools } from '@frozik/charts/agent/chart-agent-tools';
import { numberCodec, timeCodec } from '@frozik/charts/agent/x-codec';
import type { ChartModel } from '@frozik/charts/core/chart-model';
import { isTimeDomain } from '@frozik/charts/core/viewport/time-domain';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool } from '@frozik/utils/webmcp/agentTool';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import type { TimeseriesDemoStore } from './TimeseriesDemoStore';
import { DEMO_PAGES } from './TimeseriesDemoStore';

const [FIRST_PAGE = 'overview', ...OTHER_PAGES] = DEMO_PAGES;

/** The charts of the open page through the chart library's own tools, plus switching pages. */
export function createTimeseriesAgentTools(
  store: TimeseriesDemoStore,
  timeCharts: readonly ChartModel<bigint>[],
  numberCharts: readonly ChartModel<number>[]
): readonly IAgentTool[] {
  const targets = [
    ...timeCharts.map(chart =>
      defineChartTarget({
        chart,
        codec: timeCodec(
          isTimeDomain(chart.domain) ? chart.domain.timeZone : Temporal.Now.timeZoneId()
        ),
      })
    ),
    ...numberCharts.map(chart => defineChartTarget({ chart, codec: numberCodec })),
  ];

  return [
    ...defineChartTools({ prefix: 'timeseries', targets }),
    defineAgentTool({
      name: 'timeseries_open_page',
      title: 'Open a demo page',
      description:
        'Switches the charts demo to another page; its charts replace the ones the chart ' +
        'tools work on. Pages: overview (four price charts), workspace (one chart with panes, ' +
        'scales and trading sessions), marks, live (streaming), snapshot (order-book depth ' +
        'over prices), sync (two linked charts).',
      input: z.object({ page: z.enum([FIRST_PAGE, ...OTHER_PAGES]) }),
      execute: ({ page }) => {
        store.setPage(page);
        return { page };
      },
    }),
  ];
}
