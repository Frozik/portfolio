import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { assert } from '@frozik/utils/assert/assert';

import type { IEditingSlice } from '../../../extensions/editing/contracts';
import type { IViewContext } from '../../slots';

/** A pointer landing outside the cell in edit mode (and outside any dialog) commits the session. */
export const OutsideClickCommit = observer(function OutsideClickCommit<TRow>({
  table,
}: IViewContext<TRow>) {
  const slice = table.extension<IEditingSlice<TRow>>('editing');
  assert(slice !== undefined, 'OutsideClickCommit renders only with the editing extension');
  const active = slice.current !== null;

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Element &&
        (target.closest('[data-editing]') !== null || target.closest('[role="dialog"]') !== null);
      if (!inside) {
        slice.commit();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active, slice]);

  return null;
});
