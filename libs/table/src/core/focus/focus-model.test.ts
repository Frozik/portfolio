import { column } from '../columns/column';
import { ColumnsModel } from '../columns/columns-model';
import { CommandBus } from '../kernel/command-bus';
import type { ITableCommands, ITableEvents } from '../kernel/contracts';
import { EventBus } from '../kernel/event-bus';
import { clientRows } from '../rows/client-rows';
import { FocusModel } from './focus-model';

type TItem = { readonly id: number };

function focusModel() {
  const define = column<TItem>();
  const columns = new ColumnsModel<TItem>(
    [
      define({ id: 'a', title: 'A', kind: 'number', value: row => row.id }),
      define({ id: 'b', title: 'B', kind: 'number', value: row => row.id }),
    ],
    new CommandBus<ITableCommands>(),
    new EventBus<ITableEvents>()
  );
  const rows = clientRows<TItem>({ rows: () => [{ id: 1 }, { id: 2 }, { id: 3 }] })({
    rowKey: row => String(row.id),
    pipeline: [],
    reportError: () => undefined,
    guard: () => () => undefined,
  });
  return new FocusModel<TItem>(columns, () => rows);
}

describe('FocusModel', () => {
  it('starts at the first cell when moving without a focus', () => {
    const focus = focusModel();
    focus.move('down');
    expect(focus.cell).toEqual({ rowKey: '2', columnId: 'a' });
  });

  it('moves within the grid and stops at the edges', () => {
    const focus = focusModel();
    focus.focusCell('3', 'b');

    focus.move('down');
    focus.move('right');
    expect(focus.cell).toEqual({ rowKey: '3', columnId: 'b' });

    focus.move('rowStart');
    focus.move('home');
    expect(focus.cell).toEqual({ rowKey: '1', columnId: 'a' });

    focus.move('pageDown', 10);
    expect(focus.cell).toEqual({ rowKey: '3', columnId: 'a' });
  });
});
