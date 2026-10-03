import { makeAutoObservable } from 'mobx';

import type { IColumnDrag, IColumnDragPort } from '../../core/columns/column-drag-port';
import { COLUMN_MOVE_ID } from '../../core/columns/column-drag-port';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

declare module '../../core/kernel/contracts' {
  interface ITableEvents {
    /** A column is about to land: the slot it lands in and the group it joins (`null`: none, absent: whatever its neighbours share). */
    readonly 'columnMove.drop': {
      readonly columnId: string;
      readonly toIndex: number;
      readonly groupId: string | null | undefined;
    };
  }
}

export interface IColumnMoveSlice extends IColumnDragPort {
  /** Whether the column may be dragged at all; where it may land is asked per target while hovering. */
  reasonAgainst(columnId: string): string | undefined;
  begin(columnId: string): void;
  /** Moves the column to a legal target at once; an illegal or absent one leaves it where it last was. */
  hover(targetIndex: number | undefined, targetGroup?: string): void;
  /** Fixes the column where it stands. */
  drop(): TCommandOutcome | undefined;
  cancel(): void;
  move(columnId: string, toIndex: number): TCommandOutcome;
}

interface IActiveDrag {
  readonly columnId: string;
  readonly targetGroup: string | undefined;
}

class ColumnMoveSlice<TRow> implements IColumnMoveSlice {
  private active: IActiveDrag | null = null;

  constructor(private readonly kernel: ITableKernel<TRow, unknown>) {
    makeAutoObservable<ColumnMoveSlice<TRow>, 'kernel' | 'ownIndex' | 'landReason'>(
      this,
      { kernel: false, reasonAgainst: false, ownIndex: false, landReason: false },
      { autoBind: true }
    );
  }

  /** The slot comes from the columns model, which shows the column there already. */
  get drag(): IColumnDrag | null {
    if (this.active === null) {
      return null;
    }
    const { columnId, targetGroup } = this.active;
    const preview = this.kernel.columns.preview;
    return {
      columnId,
      targetIndex: preview?.columnId === columnId ? preview.toIndex : undefined,
      targetGroup,
    };
  }

  /** Probed with the column's own place: a move that changes nothing is always allowed, so only a lock can refuse. */
  reasonAgainst(columnId: string): string | undefined {
    return this.landReason(columnId, this.ownIndex(columnId));
  }

  begin(columnId: string): void {
    if (this.reasonAgainst(columnId) === undefined) {
      this.active = { columnId, targetGroup: undefined };
    }
  }

  hover(targetIndex: number | undefined, targetGroup?: string): void {
    if (this.active === null || targetIndex === undefined) {
      return;
    }
    const { columnId } = this.active;
    if (this.landReason(columnId, targetIndex) !== undefined) {
      return;
    }
    this.kernel.columns.previewMove(columnId, targetIndex);
    if (this.active.targetGroup !== targetGroup) {
      this.active = { columnId, targetGroup };
    }
  }

  drop(): TCommandOutcome | undefined {
    const drag = this.drag;
    this.cancel();
    if (drag === null || drag.targetIndex === undefined) {
      return undefined;
    }
    this.kernel.events.emit('columnMove.drop', {
      columnId: drag.columnId,
      toIndex: drag.targetIndex,
      groupId: drag.targetGroup,
    });
    return this.move(drag.columnId, drag.targetIndex);
  }

  cancel(): void {
    this.active = null;
    this.kernel.columns.clearPreview();
  }

  move(columnId: string, toIndex: number): TCommandOutcome {
    return this.kernel.columns.move(columnId, toIndex);
  }

  private landReason(columnId: string, toIndex: number): string | undefined {
    return this.kernel.commands.reasonAgainst('columns.move', { columnId, toIndex });
  }

  /** The column's index among the visible columns of its section, the space drop targets are counted in. */
  private ownIndex(columnId: string): number {
    const { orderedIds, visibleById } = this.kernel.columns;
    const section = visibleById.get(columnId)?.section;
    return orderedIds.filter(id => visibleById.get(id)?.section === section).indexOf(columnId);
  }
}

export function columnMove<TRow = never>(): ITableExtension<
  TRow,
  typeof COLUMN_MOVE_ID,
  IColumnMoveSlice
> {
  return {
    id: COLUMN_MOVE_ID,
    create(kernel): IExtensionInstance<TRow, IColumnMoveSlice> {
      return { slice: new ColumnMoveSlice(kernel), dispose: () => undefined };
    },
  };
}
