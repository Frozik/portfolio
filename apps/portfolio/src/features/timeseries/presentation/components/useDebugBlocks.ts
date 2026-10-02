import type { IDebugBlocksSlice } from '@frozik/charts/extensions/debug-blocks/core';
import { useEffect } from 'react';

/** Shows or hides the marks where runs of data begin, on every chart given. */
export function useDebugBlocks(
  charts: readonly { readonly debugBlocks: IDebugBlocksSlice<bigint> }[],
  enabled: boolean
): void {
  useEffect(() => {
    for (const chart of charts) {
      chart.debugBlocks.setEnabled(enabled);
    }
  }, [charts, enabled]);
}
