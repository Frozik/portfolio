import type { TAnyColumn } from '../../core/columns/column';
import type { ISelectionSlice } from './contracts';

export const SELECTION_COLUMN_ID = 'selection';
const SELECTION_COLUMN_WIDTH = 36;

/** The checkbox column: pinned first, fixed width, hidden while row selection is off. */
export function selectionColumn<TRow>(slice: ISelectionSlice<TRow>): TAnyColumn<TRow> {
  return {
    id: SELECTION_COLUMN_ID,
    title: '',
    kind: 'custom',
    value: () => undefined,
    width: SELECTION_COLUMN_WIDTH,
    minWidth: SELECTION_COLUMN_WIDTH,
    maxWidth: SELECTION_COLUMN_WIDTH,
    align: 'center',
    interactive: true,
    lock: { pin: true, move: true, hide: true, resize: true },
    get hidden() {
      return slice.mode.rows === 'none';
    },
  };
}
