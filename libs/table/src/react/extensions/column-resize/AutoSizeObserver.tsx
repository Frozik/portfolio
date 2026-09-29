import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import { assert } from '@frozik/utils/assert/assert';

import type { IColumnResizeSlice } from '../../../extensions/column-resize/core';
import { useTableContext } from '../../context';
import type { IViewContext } from '../../slots';
import { createMeasurePort } from './measurePort';

/**
 * Gives the slice a way to measure the rendered table and runs an autosize
 * pass whenever the rendered content changes: rows scrolled in, data
 * updated, columns added. Passes are coalesced into one animation frame; a
 * pass changes column widths, never the content, so it does not feed itself.
 */
export const AutoSizeObserver = observer(function AutoSizeObserver<TRow>({
  table,
}: IViewContext<TRow>) {
  const { rootRef } = useTableContext<TRow>();
  const slice = table.extension<IColumnResizeSlice>('columnResize');
  assert(slice !== undefined, 'AutoSizeObserver renders only with the column-resize extension');
  const mode = slice.autoSizeMode;

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return undefined;
    }
    slice.attachMeasurePort(createMeasurePort(root));
    return () => slice.attachMeasurePort(undefined);
  }, [rootRef, slice]);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || mode === 'off') {
      return undefined;
    }
    let frame: number | undefined = undefined;
    const schedule = (): void => {
      frame ??= requestAnimationFrame(() => {
        frame = undefined;
        slice.autoSizePass();
      });
    };
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    schedule();
    return () => {
      mutations.disconnect();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, [rootRef, slice, mode]);

  return null;
});
