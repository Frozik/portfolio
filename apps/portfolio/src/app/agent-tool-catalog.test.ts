import { createChart } from '@frozik/charts/core/create-chart';
import { numberDomain } from '@frozik/charts/core/viewport/number-domain';
import { column } from '@frozik/table/core/columns/column';
import { createTable } from '@frozik/table/core/create-table';
import { clientRows } from '@frozik/table/core/rows/client-rows';
import { editing } from '@frozik/table/extensions/editing/core';
import { filtering } from '@frozik/table/extensions/filtering/core';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import { sorting } from '@frozik/table/extensions/sorting/core';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';

import { createControlsAgentTools } from '../features/controls/application/controls-agent-tools';
import { ControlsDemoStore } from '../features/controls/application/ControlsDemoStore';
import { createSudokuAgentTools } from '../features/sudoku/application/sudoku-agent-tools';
import { SudokuStore } from '../features/sudoku/application/SudokuStore';
import { createTableAgentTools } from '../features/table/application/table-agent-tools';
import type { IDemoTrade } from '../features/table/domain/demo-trade';
import { createTimeseriesAgentTools } from '../features/timeseries/application/timeseries-agent-tools';
import { TimeseriesDemoStore } from '../features/timeseries/application/TimeseriesDemoStore';
import { TOOL_CATALOG } from '../features/webmcp/presentation/tool-catalog';
import { createAppAgentTools } from './appAgentTools';

function namesOf(tools: readonly IAgentTool[]): readonly string[] {
  return tools.map(tool => tool.name);
}

function catalogued(id: string): readonly string[] {
  return TOOL_CATALOG.find(section => section.id === id)?.tools ?? [];
}

const define = column<IDemoTrade>();

describe('the WebMCP page', () => {
  it('lists exactly the tools every page registers', () => {
    const tools = createAppAgentTools({ openPath: () => {}, currentPathname: () => '/' });

    expect(namesOf(tools)).toEqual(catalogued('everywhere'));
  });

  it('lists exactly the sudoku tools', () => {
    const tools = createSudokuAgentTools(new SudokuStore({ generate: () => '' }), () => {});

    expect(namesOf(tools)).toEqual(catalogued('sudoku'));
  });

  it('lists exactly the chart tools of a page', () => {
    const chart = createChart({
      id: 'chart',
      x: { domain: numberDomain, start: 0, end: 1 },
      series: [],
      extensions: [],
    });
    const tools = createTimeseriesAgentTools(new TimeseriesDemoStore(), [], [chart]);

    expect(namesOf(tools)).toEqual(catalogued('timeseries'));
  });

  it('lists exactly the table tools', () => {
    const table = createTable({
      columns: [define({ id: 'symbol', title: 'Symbol', kind: 'text', value: row => row.symbol })],
      rowKey: 'id',
      rows: clientRows<IDemoTrade>({ rows: () => [] }),
      extensions: [gridView(), sorting(), filtering(), editing()],
      context: undefined,
    });

    expect(namesOf(createTableAgentTools(table))).toEqual(catalogued('table'));
  });

  it('lists exactly the controls tools', () => {
    expect(namesOf(createControlsAgentTools(new ControlsDemoStore()))).toEqual(
      catalogued('controls')
    );
  });
});
