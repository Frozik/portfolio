import { assert } from '@frozik/utils/assert/assert';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import { isNil, uniq } from 'lodash-es';
import { z } from 'zod';

import type { ChartCommandOutcome, IChartAgentTarget } from './chart-agent-target';

const MIN_FACTOR = 0.01;
const MAX_FACTOR = 100;
const MAX_SCREENS = 50;

/**
 * WebMCP tools over the charts of a page, one `chart` argument choosing among them:
 * read what each shows, zoom and scroll along X, jump to a position or range, fit the
 * data, stretch or release value scales, follow live data and read values at a point.
 * Every command answers with the chart as it now is, so the agent sees the effect.
 */
export function defineChartTools({
  prefix,
  targets,
}: {
  readonly prefix: string;
  readonly targets: readonly IChartAgentTarget[];
}): readonly IAgentTool[] {
  const [first, ...rest] = targets.map(target => target.id);
  if (isNil(first)) {
    return [];
  }
  assert(
    uniq(targets.map(target => target.id)).length === targets.length,
    'chart ids must be unique'
  );

  const byId = new Map(targets.map(target => [target.id, target]));
  const chart = z.enum([first, ...rest]).describe('Which chart; see `' + prefix + '_list_charts`.');
  const formats = uniq(targets.map(target => target.xFormat)).join('; or ');
  const position = z.string().describe(`A position on the X axis: ${formats}.`);
  const factor = z
    .number()
    .min(MIN_FACTOR)
    .max(MAX_FACTOR)
    .describe('How much of the current range to show: 0.5 zooms in twice, 2 zooms out twice.');

  const targetOf = (id: string): IChartAgentTarget => {
    const target = byId.get(id);
    assert(!isNil(target), `no chart ${id}`);
    return target;
  };
  const answer = (target: IChartAgentTarget, outcome: ChartCommandOutcome) =>
    outcome.ok ? target.describe() : refuse(outcome.reason);

  return [
    defineAgentTool({
      name: `${prefix}_list_charts`,
      title: 'List the charts',
      description:
        'Lists the charts on the page: the X range each shows and the range its data covers, ' +
        'its value scales (whether held by hand or auto-scaled), its series and whether it ' +
        'follows live data.',
      input: z.object({}),
      readOnly: true,
      execute: () => targets.map(target => target.describe()),
    }),
    defineAgentTool({
      name: `${prefix}_zoom`,
      title: 'Zoom along X',
      description:
        'Zooms a chart along X round a position (the middle of the view by default), as the ' +
        'mouse wheel does.',
      input: z.object({ chart, factor, at: position.optional() }),
      execute: ({ chart: id, factor: by, at }) => {
        const target = targetOf(id);
        return answer(target, target.zoom(by, at));
      },
    }),
    defineAgentTool({
      name: `${prefix}_scroll`,
      title: 'Scroll along X',
      description:
        'Scrolls a chart by a number of screen widths, as a drag does: positive moves to later ' +
        'X (right), negative to earlier X (left); 0.5 is half a screen.',
      input: z.object({ chart, screens: z.number().min(-MAX_SCREENS).max(MAX_SCREENS) }),
      execute: ({ chart: id, screens }) => {
        const target = targetOf(id);
        return answer(target, target.scroll(screens));
      },
    }),
    defineAgentTool({
      name: `${prefix}_go_to`,
      title: 'Go to a position',
      description: 'Centres a chart on an X position, keeping how much it shows.',
      input: z.object({ chart, x: position }),
      execute: ({ chart: id, x }) => {
        const target = targetOf(id);
        return answer(target, target.goTo(x));
      },
    }),
    defineAgentTool({
      name: `${prefix}_show_range`,
      title: 'Show an X range',
      description:
        'Makes a chart show exactly the X range from one position to another; the chart may ' +
        'narrow it to its own limits.',
      input: z.object({ chart, from: position, to: position }),
      execute: ({ chart: id, from, to }) => {
        const target = targetOf(id);
        return answer(target, target.showRange(from, to));
      },
    }),
    defineAgentTool({
      name: `${prefix}_fit`,
      title: 'Fit the data',
      description: 'Makes a chart show all the data it has loaded so far.',
      input: z.object({ chart }),
      execute: ({ chart: id }) => {
        const target = targetOf(id);
        return answer(target, target.fit());
      },
    }),
    defineAgentTool({
      name: `${prefix}_zoom_scale`,
      title: 'Zoom a value scale',
      description:
        'Stretches one value (Y) scale round its middle and holds it there, so auto-scaling ' +
        `leaves it alone until \`${prefix}_reset_scales\`.`,
      input: z.object({
        chart,
        scale: z.string().describe('A scale id from the chart description.'),
        factor,
      }),
      execute: ({ chart: id, scale, factor: by }) => {
        const target = targetOf(id);
        return answer(target, target.zoomScale(scale, by));
      },
    }),
    defineAgentTool({
      name: `${prefix}_reset_scales`,
      title: 'Reset value scales',
      description:
        'Hands value scales back to auto-scaling, as a double tap on a scale does: one scale, ' +
        'or all of them when none is named.',
      input: z.object({ chart, scale: z.string().optional() }),
      execute: ({ chart: id, scale }) => {
        const target = targetOf(id);
        return answer(target, target.resetScales(scale));
      },
    }),
    defineAgentTool({
      name: `${prefix}_follow_live`,
      title: 'Follow live data',
      description:
        'Brings a live chart back to its newest data and keeps following it; refused by charts ' +
        'that do not stream.',
      input: z.object({ chart }),
      execute: ({ chart: id }) => {
        const target = targetOf(id);
        return answer(target, target.followLive());
      },
    }),
    defineAgentTool({
      name: `${prefix}_values_at`,
      title: 'Read values at a position',
      description:
        "Reads each series' element nearest to an X position from what the chart last drew: " +
        'its X, its value, and open/high/low/close for candles.',
      input: z.object({ chart, x: position }),
      readOnly: true,
      execute: ({ chart: id, x }) => {
        const outcome = targetOf(id).valuesAt(x);
        return outcome.ok ? outcome.values : refuse(outcome.reason);
      },
    }),
  ];
}
