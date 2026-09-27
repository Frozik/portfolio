import type { TPinSide } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TMenuItem } from '../../core/kernel/menu';

export interface IPinningSlice {
  sideOf(columnId: string): TPinSide | undefined;
  pin(columnId: string, side: TPinSide | null): TCommandOutcome;
  reasonAgainst(columnId: string, side: TPinSide | null): string | undefined;
}

export function pinning<TRow = never>(): ITableExtension<TRow, 'pinning', IPinningSlice> {
  return {
    id: 'pinning',
    create(kernel: ITableKernel<TRow, unknown>): IExtensionInstance<TRow, IPinningSlice> {
      const slice: IPinningSlice = {
        sideOf: columnId => kernel.columns.pinOf(columnId),
        pin: (columnId, side) => kernel.columns.pin(columnId, side),
        reasonAgainst: (columnId, side) =>
          kernel.commands.reasonAgainst('columns.pin', { columnId, side }),
      };
      const item = (columnId: string, side: TPinSide | null): TMenuItem => ({
        id: `pinning.${side ?? 'none'}`,
        label: `menu.pin.${side ?? 'none'}`,
        section: 'columns',
        disabled:
          (slice.sideOf(columnId) ?? null) === side ||
          (slice.reasonAgainst(columnId, side) ?? false),
        run: () => void slice.pin(columnId, side),
      });
      return {
        slice,
        menu: ({ target, columnId }) =>
          target !== 'header' || columnId === undefined || kernel.columns.isService(columnId)
            ? []
            : [item(columnId, 'left'), item(columnId, 'right'), item(columnId, null)],
        dispose: () => undefined,
      };
    },
  };
}
