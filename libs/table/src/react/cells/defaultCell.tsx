import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TColumnKind } from '../../core/columns/column';
import type { TCellComponent } from '../column';
import { BooleanCell } from './BooleanCell';
import { DateCell } from './dateCell';
import { NumberCell } from './numberCell';
import { TextCell } from './TextCell';

/** The built-in component of a column kind, for both modes. */
export function defaultCellFor<TRow>(kind: TColumnKind): TCellComponent<TRow> {
  switch (kind) {
    case 'text':
    case 'custom':
      return TextCell as TCellComponent<TRow>;
    case 'number':
      return NumberCell as TCellComponent<TRow>;
    case 'date':
    case 'datetime':
      return DateCell as TCellComponent<TRow>;
    case 'boolean':
      return BooleanCell as TCellComponent<TRow>;
    default:
      return assertNever(kind);
  }
}
