import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IKeyBinding } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { ISelectionSlice } from './contracts';

function focusedKey<TRow>(kernel: ITableKernel<TRow, unknown>): string | undefined {
  return kernel.focus.cell?.rowKey;
}

export function selectionKeys<TRow>(slice: ISelectionSlice<TRow>): readonly IKeyBinding<TRow>[] {
  const withFocusedRow =
    (run: (rowKey: string) => TCommandOutcome) =>
    (kernel: ITableKernel<TRow, unknown>): boolean => {
      const rowKey = focusedKey(kernel);
      return rowKey !== undefined && run(rowKey).ok;
    };
  const extendTo =
    (direction: 'up' | 'down' | 'left' | 'right') =>
    (kernel: ITableKernel<TRow, unknown>): boolean => {
      if (!slice.mode.cells || kernel.focus.cell === null) {
        return false;
      }
      if (slice.ranges.length === 0) {
        slice.startRange(kernel.focus.cell);
      }
      kernel.focus.move(direction);
      return kernel.focus.cell !== null && slice.extendRange(kernel.focus.cell).ok;
    };
  return [
    { key: ' ', target: 'cell', run: withFocusedRow(slice.toggle) },
    {
      key: 'Shift+ ',
      target: 'cell',
      run: withFocusedRow(rowKey => slice.range(rowKey, { add: true })),
    },
    {
      key: 'Mod+a',
      target: 'cell',
      run: () => (slice.mode.cells ? slice.selectAllCells().ok : slice.selectAll().ok),
    },
    { key: 'Escape', target: 'cell', run: () => slice.hasSelection && slice.clear().ok },
    { key: 'Shift+ArrowUp', target: 'cell', run: extendTo('up') },
    { key: 'Shift+ArrowDown', target: 'cell', run: extendTo('down') },
    { key: 'Shift+ArrowLeft', target: 'cell', run: extendTo('left') },
    { key: 'Shift+ArrowRight', target: 'cell', run: extendTo('right') },
  ];
}
