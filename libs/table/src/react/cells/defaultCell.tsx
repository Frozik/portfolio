import type { TColumnKind } from '../../core/columns/column';
import type { TCellComponent } from '../column';
import { BooleanCell } from './BooleanCell';

/** Text-like kinds render their text straight into the cell: no component, no inner element. */
export function defaultCellFor<TRow>(kind: TColumnKind): TCellComponent<TRow> | undefined {
  return kind === 'boolean' ? BooleanCell : undefined;
}
