import { makeAutoObservable } from 'mobx';

import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

export interface IColumnDrag {
  readonly columnId: string;
  /** Where the column would land, as an index among the columns of its own section. */
  readonly targetIndex: number | undefined;
}

export interface IColumnMoveSlice {
  readonly drag: IColumnDrag | null;
  reasonAgainst(columnId: string): string | undefined;
  begin(columnId: string): void;
  hover(targetIndex: number | undefined): void;
  drop(): TCommandOutcome | undefined;
  cancel(): void;
  move(columnId: string, toIndex: number): TCommandOutcome;
}

class ColumnMoveSlice<TRow> implements IColumnMoveSlice {
  drag: IColumnDrag | null = null;

  constructor(private readonly kernel: ITableKernel<TRow, unknown>) {
    makeAutoObservable<ColumnMoveSlice<TRow>, 'kernel'>(
      this,
      { kernel: false, reasonAgainst: false },
      { autoBind: true }
    );
  }

  reasonAgainst(columnId: string): string | undefined {
    return this.kernel.commands.reasonAgainst('columns.move', { columnId, toIndex: 0 });
  }

  begin(columnId: string): void {
    if (this.reasonAgainst(columnId) === undefined) {
      this.drag = { columnId, targetIndex: undefined };
    }
  }

  hover(targetIndex: number | undefined): void {
    if (this.drag !== null && this.drag.targetIndex !== targetIndex) {
      this.drag = { ...this.drag, targetIndex };
    }
  }

  drop(): TCommandOutcome | undefined {
    const drag = this.drag;
    this.drag = null;
    if (drag === null || drag.targetIndex === undefined) {
      return undefined;
    }
    return this.move(drag.columnId, drag.targetIndex);
  }

  cancel(): void {
    this.drag = null;
  }

  move(columnId: string, toIndex: number): TCommandOutcome {
    return this.kernel.columns.move(columnId, toIndex);
  }
}

export function columnMove<TRow = never>(): ITableExtension<TRow, 'columnMove', IColumnMoveSlice> {
  return {
    id: 'columnMove',
    create(kernel): IExtensionInstance<TRow, IColumnMoveSlice> {
      return { slice: new ColumnMoveSlice(kernel), dispose: () => undefined };
    },
  };
}
