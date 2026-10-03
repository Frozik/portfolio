export const COLUMN_MOVE_ID = 'columnMove';

export interface IColumnDrag {
  readonly columnId: string;
  /** Where the column stands right now, as a slot among the visible columns of its own section; absent until a first legal target. */
  readonly targetIndex: number | undefined;
  /** The group header the pointer is over: the column joins that group at the slot. */
  readonly targetGroup: string | undefined;
}

/**
 * What the kernel lets other extensions know about a column being dragged,
 * so that column groups can show where it is going without depending on the
 * column-move extension itself. Read it with `kernel.extension<IColumnDragPort>(COLUMN_MOVE_ID)`.
 */
export interface IColumnDragPort {
  readonly drag: IColumnDrag | null;
}
