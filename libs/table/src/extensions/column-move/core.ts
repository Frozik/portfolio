import { makeAutoObservable } from 'mobx';

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

export interface IColumnDrag {
  readonly columnId: string;
  /** Where the column would land, as a slot among the visible columns of its own section. */
  readonly targetIndex: number | undefined;
  /** The group header the pointer is over: the column joins that group at the slot. */
  readonly targetGroup: string | undefined;
}

export interface IColumnMoveSlice {
  readonly drag: IColumnDrag | null;
  /** Whether the column may be dragged at all; where it may land is asked per target while hovering. */
  reasonAgainst(columnId: string): string | undefined;
  begin(columnId: string): void;
  /** Marks the target when the column may land there; an illegal target shows no marker and drops nowhere. */
  hover(targetIndex: number | undefined, targetGroup?: string): void;
  drop(): TCommandOutcome | undefined;
  cancel(): void;
  move(columnId: string, toIndex: number): TCommandOutcome;
}

class ColumnMoveSlice<TRow> implements IColumnMoveSlice {
  drag: IColumnDrag | null = null;

  constructor(private readonly kernel: ITableKernel<TRow, unknown>) {
    makeAutoObservable<ColumnMoveSlice<TRow>, 'kernel' | 'ownIndex' | 'landReason'>(
      this,
      { kernel: false, reasonAgainst: false, ownIndex: false, landReason: false },
      { autoBind: true }
    );
  }

  /** Probed with the column's own place: a move that changes nothing is always allowed, so only a lock can refuse. */
  reasonAgainst(columnId: string): string | undefined {
    return this.landReason(columnId, this.ownIndex(columnId));
  }

  begin(columnId: string): void {
    if (this.reasonAgainst(columnId) === undefined) {
      this.drag = { columnId, targetIndex: undefined, targetGroup: undefined };
    }
  }

  hover(targetIndex: number | undefined, targetGroup?: string): void {
    if (this.drag === null) {
      return;
    }
    const legal =
      targetIndex !== undefined && this.landReason(this.drag.columnId, targetIndex) === undefined;
    const next = legal ? targetIndex : undefined;
    const group = legal ? targetGroup : undefined;
    if (this.drag.targetIndex !== next || this.drag.targetGroup !== group) {
      this.drag = { ...this.drag, targetIndex: next, targetGroup: group };
    }
  }

  drop(): TCommandOutcome | undefined {
    const drag = this.drag;
    this.drag = null;
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
    this.drag = null;
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

export function columnMove<TRow = never>(): ITableExtension<TRow, 'columnMove', IColumnMoveSlice> {
  return {
    id: 'columnMove',
    create(kernel): IExtensionInstance<TRow, IColumnMoveSlice> {
      return { slice: new ColumnMoveSlice(kernel), dispose: () => undefined };
    },
  };
}
